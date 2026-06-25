/**
 * src/llm/ProviderFailover.ts
 *
 * Provider failover with circuit breaker, failure classification, probe
 * recovery, and per-member provider preferences.
 *
 * Implements architecture/provider-failover.md:
 * - Failure classification (401/402/429/408/503/404)
 * - Three-state circuit breaker (CLOSED → OPEN → HALF_OPEN → CLOSED)
 * - Probe recovery 30s before cooldown expiry
 * - 5 recovery strategies
 */

import type { ILLMProvider } from './ILLMProvider.js'
import type { LLMRequest, LLMResponse, LLMChunk } from './types.js'
import {
  AuthError,
  PaymentRequiredError,
  RateLimitedError,
  TimeoutError,
  ServiceUnavailableError,
  ModelNotFoundError,
} from './errors.js'

// ---------------------------------------------------------------------------
// Circuit breaker state
// ---------------------------------------------------------------------------

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

interface CircuitBreakerState {
  state: CircuitState
  failureCount: number
  cooldownUntil: number
  probeScheduledAt: number
}

// ---------------------------------------------------------------------------
// Failure classification
// ---------------------------------------------------------------------------

export interface ClassifiedError {
  category: 'auth' | 'payment' | 'rate_limited' | 'timeout' | 'unavailable' | 'model_not_found' | 'unknown'
  retryable: boolean
  retryAfter: number  // seconds
  cooldownMs: number  // ms to cool down before probe
  permanent: boolean
}

export function classifyError(err: unknown): ClassifiedError {
  if (err instanceof AuthError) {
    return { category: 'auth', retryable: false, retryAfter: 0, cooldownMs: 0, permanent: true }
  }
  if (err instanceof PaymentRequiredError) {
    return { category: 'payment', retryable: false, retryAfter: 0, cooldownMs: 0, permanent: true }
  }
  if (err instanceof RateLimitedError) {
    return { category: 'rate_limited', retryable: true, retryAfter: err.retryAfter, cooldownMs: err.retryAfter * 1000, permanent: false }
  }
  if (err instanceof TimeoutError) {
    return { category: 'timeout', retryable: true, retryAfter: 30, cooldownMs: 30_000, permanent: false }
  }
  if (err instanceof ServiceUnavailableError) {
    return { category: 'unavailable', retryable: true, retryAfter: 60, cooldownMs: 60_000, permanent: false }
  }
  if (err instanceof ModelNotFoundError) {
    return { category: 'model_not_found', retryable: false, retryAfter: 0, cooldownMs: 0, permanent: true }
  }

  // Classify by HTTP status embedded in error message or generic SDK error
  const msg = err instanceof Error ? err.message : String(err)
  const statusMatch = msg.match(/\b(40[12]|408|429|50[0-9])\b/)

  if (statusMatch) {
    const status = parseInt(statusMatch[1], 10)
    if (status === 401) return { category: 'auth', retryable: false, retryAfter: 0, cooldownMs: 0, permanent: true }
    if (status === 402) return { category: 'payment', retryable: false, retryAfter: 0, cooldownMs: 0, permanent: true }
    if (status === 408) return { category: 'timeout', retryable: true, retryAfter: 30, cooldownMs: 30_000, permanent: false }
    if (status === 429) return { category: 'rate_limited', retryable: true, retryAfter: 60, cooldownMs: 60_000, permanent: false }
    if (status >= 500) return { category: 'unavailable', retryable: true, retryAfter: 60, cooldownMs: 60_000, permanent: false }
  }

  return { category: 'unknown', retryable: false, retryAfter: 0, cooldownMs: 0, permanent: false }
}

// ---------------------------------------------------------------------------
// AllProvidersFailedError
// ---------------------------------------------------------------------------

export class AllProvidersFailedError extends Error {
  readonly category: string

  constructor(errors: string[], category: string = 'unknown') {
    super(`All providers failed: ${errors.join('; ')}`)
    this.name = 'AllProvidersFailedError'
    this.category = category
  }
}

// ---------------------------------------------------------------------------
// ProviderChain
// ---------------------------------------------------------------------------

export class ProviderChain implements ILLMProvider {
  private circuitBreakers = new Map<string, CircuitBreakerState>()
  private providerNames: string[]
  readonly modelMap: Map<string, string[]>

  constructor(
    private providers: ILLMProvider[],
    providerNames?: string[],
    private readonly chainConfig: ProviderChainConfig = {},
    modelMap?: Map<string, string[]>,
  ) {
    this.providerNames = providerNames ?? providers.map((p) => p.constructor.name.replace('Provider', '').toLowerCase())
    this.modelMap = modelMap ?? new Map()
    for (const name of this.providerNames) {
      this.circuitBreakers.set(name, this.freshState())
    }
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const errors: string[] = []
    const active = this.activeProviders()

    if (active.length === 0) {
      throw new AllProvidersFailedError(['all providers in OPEN state'], 'unavailable')
    }

    for (let i = 0; i < active.length; i++) {
      const provider = active[i]
      const name = this.providerName(provider)
      const breaker = this.circuitBreakers.get(name)!

      if (breaker.state === 'OPEN') {
        continue
      }

      try {
        const result = await this.executeWithStrategy(provider, request, i)
        this.onSuccess(name)
        return result
      } catch (err) {
        const classified = classifyError(err)
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`${name}: ${msg}`)

        if (classified.permanent) {
          this.tripBreaker(name, Infinity) // never retry
        } else if (classified.retryable) {
          this.tripBreaker(name, classified.cooldownMs)
        }

        // If this was the last provider, escalate
        if (i === active.length - 1) {
          throw new AllProvidersFailedError(errors, classified.category)
        }
      }
    }

    throw new AllProvidersFailedError(errors)
  }

  /** Try each active provider in order, with model downgrade on failure. */
  async stream(request: LLMRequest): Promise<AsyncGenerator<LLMChunk>> {
    const errors: string[] = []
    const active = this.activeProviders()

    if (active.length === 0) {
      throw new AllProvidersFailedError(['all providers in OPEN state'], 'unavailable')
    }

    for (const provider of active) {
      const name = this.providerName(provider)
      const breaker = this.circuitBreakers.get(name)!

      if (breaker.state === 'OPEN') {
        continue
      }

      // Strategy 4: model downgrade — try fallback models on same provider
      const models = this.modelMap.get(name)
      const fallbackModels = models && models.length > 1 ? models.slice(1) : undefined
      let lastError: unknown

      for (let attempt = 0; attempt <= (fallbackModels?.length ?? 0); attempt++) {
        if (attempt > 0 && fallbackModels) {
          provider.setModel(fallbackModels[attempt - 1])
        }

        try {
          // Eagerly try the first chunk so that generator-initialisation
          // errors (e.g. auth failure, model not found) are caught here
          // rather than on the caller's first iteration.
          const gen = await provider.stream(request)
          const first = await gen.next()

          if (first.done) {
            this.onSuccess(name)
            return emptyGenerator()
          }

          this.onSuccess(name)
          return firstChunkGenerator(first.value, gen)
        } catch (err) {
          lastError = err
          const classified = classifyError(err)
          // ModelNotFoundError is model-specific, not provider-fatal — try next fallback
          if (classified.permanent && classified.category !== 'model_not_found') break
        }
      }

      // All model attempts on this provider failed
      if (lastError) {
        const classified = classifyError(lastError)
        const msg = lastError instanceof Error ? lastError.message : String(lastError)
        errors.push(`${name}: ${msg}`)

        if (classified.permanent) {
          this.tripBreaker(name, Infinity)
        } else if (classified.retryable) {
          this.tripBreaker(name, classified.cooldownMs)
        }
      }
    }

    throw new AllProvidersFailedError(errors)
  }

  /** Try each active provider in order, with model downgrade on failure. */
  async embed(text: string): Promise<number[]> {
    const errors: string[] = []
    const active = this.activeProviders()

    for (const provider of active) {
      const name = this.providerName(provider)

      // Strategy 4: model downgrade — try fallback models on same provider
      const models = this.modelMap.get(name)
      const fallbackModels = models && models.length > 1 ? models.slice(1) : undefined
      let lastError: unknown

      for (let attempt = 0; attempt <= (fallbackModels?.length ?? 0); attempt++) {
        if (attempt > 0 && fallbackModels) {
          provider.setModel(fallbackModels[attempt - 1])
        }

        try {
          const result = await provider.embed(text)
          this.onSuccess(name)
          return result
        } catch (err) {
          lastError = err
          const classified = classifyError(err)
          if (classified.permanent && classified.category !== 'model_not_found') break
        }
      }

      if (lastError) {
        const classified = classifyError(lastError)
        const msg = lastError instanceof Error ? lastError.message : String(lastError)
        errors.push(`${name}: ${msg}`)

        if (classified.permanent) {
          this.tripBreaker(name, Infinity)
        } else if (classified.retryable) {
          this.tripBreaker(name, classified.cooldownMs)
        }
      }
    }

    throw new AllProvidersFailedError(errors)
  }

  /** Build a failover chain for a given member. */
  static buildChain(
    providers: Map<string, ILLMProvider>,
    preferred: string,
    fallbackOrder: string[],
    modelMap?: Map<string, string[]>,
  ): { chain: ProviderChain; names: string[] } {
    // Preferred first, then the rest in fallbackOrder, deduplicated
    const ordered = [preferred, ...fallbackOrder.filter((f) => f !== preferred)]
    const available: ILLMProvider[] = []
    const names: string[] = []

    for (const name of ordered) {
      const p = providers.get(name)
      if (p) {
        available.push(p)
        names.push(name)
      }
    }

    return { chain: new ProviderChain(available, names, undefined, modelMap), names }
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private async executeWithStrategy(
    provider: ILLMProvider,
    request: LLMRequest,
    index: number,
  ): Promise<LLMResponse> {
    let lastError: unknown

    // Strategies 1-2: immediate retry + exponential backoff (3 attempts)
    for (let retry = 0; retry < 3; retry++) {
      try {
        if (retry > 0) {
          await sleep(1000 * Math.pow(2, retry - 1 + index))
        }
        return await provider.complete(request)
      } catch (err) {
          lastError = err
          const classified = classifyError(err)
          // ModelNotFoundError is model-specific — fall through to Strategy 4 for fallback models
          if (classified.permanent && classified.category !== 'model_not_found') throw err
      }
    }

    // Strategy 3: provider rotation is handled by the caller loop

    // Strategy 4: model downgrade — try fallback models on same provider
    const name = this.providerName(provider)
    const models = this.modelMap.get(name)
    if (models && models.length > 1) {
      for (const model of models.slice(1)) {
        try {
          provider.setModel(model)
          return await provider.complete(request)
        } catch (err) {
          lastError = err
          const classified = classifyError(err)
          // ModelNotFoundError is model-specific, not provider-fatal — try next fallback
          if (classified.permanent && classified.category !== 'model_not_found') break
        }
      }
    }

    throw lastError
  }

  private onSuccess(name: string): void {
    const breaker = this.circuitBreakers.get(name)
    if (!breaker) return
    breaker.state = 'CLOSED'
    breaker.failureCount = 0
    breaker.cooldownUntil = 0
    breaker.probeScheduledAt = 0
  }

  /**
   * Record a failure and open the circuit if the threshold is exceeded.
   * Permanent errors (cooldownMs === Infinity) always open immediately
   * regardless of failureThreshold — retrying a bad API key wastes quota.
   */
  private tripBreaker(name: string, cooldownMs: number): void {
    const breaker = this.circuitBreakers.get(name)
    if (!breaker) return

    breaker.failureCount++

    // Permanent errors (auth, payment, model_not_found) always open the
    // circuit immediately regardless of failureThreshold — retrying a bad
    // API key wastes quota and time.
    if (cooldownMs === Infinity) {
      breaker.state = 'OPEN'
      breaker.cooldownUntil = Infinity
      breaker.probeScheduledAt = 0
      return
    }

    const threshold = this.chainConfig.failureThreshold ?? 1
    if (breaker.failureCount < threshold) return

    breaker.state = 'OPEN'
    const effectiveCooldown = this.chainConfig.cooldownMs ?? cooldownMs
    breaker.cooldownUntil = effectiveCooldown === Infinity ? Infinity : Date.now() + effectiveCooldown

    if (this.chainConfig.probeEnabled ?? true) {
      if (effectiveCooldown > 30_000 && effectiveCooldown !== Infinity) {
        breaker.probeScheduledAt = Date.now() + effectiveCooldown - 30_000
      } else {
        breaker.probeScheduledAt = 0
      }
    } else {
      breaker.probeScheduledAt = 0
    }
  }

  private activeProviders(): ILLMProvider[] {
    for (const [, breaker] of this.circuitBreakers) {
      if (breaker.state !== 'OPEN') continue

      // Check 1: probe recovery (30s before cooldown expiry)
      const probeEnabled = this.chainConfig.probeEnabled ?? true
      if (probeEnabled && breaker.probeScheduledAt > 0 && Date.now() >= breaker.probeScheduledAt) {
        breaker.state = 'HALF_OPEN'
        breaker.probeScheduledAt = 0
        continue
      }

      // Check 2: cooldown expired naturally — allow a probe attempt
      if (breaker.cooldownUntil > 0 && breaker.cooldownUntil !== Infinity && Date.now() >= breaker.cooldownUntil) {
        breaker.state = 'HALF_OPEN'
        breaker.cooldownUntil = 0
      }
    }

    return this.providers.filter((p) => {
      const breaker = this.circuitBreakers.get(this.providerName(p))
      if (!breaker) return true
      return breaker.state !== 'OPEN'
    })
  }

  private providerName(provider: ILLMProvider): string {
    const idx = this.providers.indexOf(provider)
    return idx >= 0 && idx < this.providerNames.length
      ? this.providerNames[idx]
      : provider.constructor.name.replace('Provider', '').toLowerCase()
  }

  private freshState(): CircuitBreakerState {
    return { state: 'CLOSED', failureCount: 0, cooldownUntil: 0, probeScheduledAt: 0 }
  }

  /** Exposed for testing */
  getBreakerState(name: string): CircuitBreakerState | undefined {
    return this.circuitBreakers.get(name)
  }

  setModel(model: string): void {
    const first = this.providers[0]
    if (first) first.setModel(model)
  }

  getContextWindow(): number {
    return this.providers[0]?.getContextWindow() ?? 8192
  }
}

/** AsyncGenerator that yields no values and completes immediately. */
function emptyGenerator(): AsyncGenerator<LLMChunk> {
  return (async function* () {})()
}

/** AsyncGenerator that yields a first chunk then delegates to `rest`. */
function firstChunkGenerator(
  first: LLMChunk,
  rest: AsyncGenerator<LLMChunk>,
): AsyncGenerator<LLMChunk> {
  return (async function* () {
    yield first
    yield* rest
  })()
}

/** Configurable limits for provider-level retry behaviour within a chain. */
export interface ProviderChainConfig {
  /** Maximum retry attempts per provider (default: 3). */
  maxRetries?: number
  /** Base delay for exponential backoff in ms (default: 1000). */
  backoffBaseMs?: number
  /** Consecutive failures before circuit opens (default: 1). */
  failureThreshold?: number
  /** Override cooldown duration in ms (overrides error-classified cooldown). */
  cooldownMs?: number
  /** Whether preemptive probe recovery is enabled (default: true). */
  probeEnabled?: boolean
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
