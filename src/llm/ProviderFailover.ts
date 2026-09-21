/**
 * src/llm/ProviderFailover.ts
 *
 * Provider failover with circuit breaker, failure classification, probe
 * recovery, and per-member provider preferences.
 *
 * Implements docs/architecture/provider-failover.md:
 * - Failure classification (401/402/429/408/503/404)
 * - Three-state circuit breaker (CLOSED → OPEN → HALF_OPEN → CLOSED)
 * - Probe recovery 30s before cooldown expiry
 * - 5 recovery strategies
 */

import type { ILLMProvider } from './ILLMProvider.ts'
import type { LLMRequest, LLMResponse, LLMChunk } from './types.ts'
import type { ProviderChainConfig } from './providerFailoverTypes.ts'
import type { CircuitBreakerState } from './providerFailoverTypes.ts'
import { classifyError, AllProvidersFailedError } from './ProviderFailoverError.ts'
import { TimeoutError } from './errors.ts'
export { classifyError, AllProvidersFailedError }

/**
 * Orchestrates multiple LLM providers with failover, circuit breaker,
 * failure classification, and probe recovery.
 *
 * Usage:
 * ```
 * const chain = new ProviderChain([groq, openai, ollama], ['groq', 'openai', 'ollama'])
 * const response = await chain.complete(request)
 * ```
 *
 * If the first provider fails, the chain tries the next, applying
 * retry strategies and circuit breaker state per provider.
 */
export class ProviderChain implements ILLMProvider {
  private circuitBreakers = new Map<string, CircuitBreakerState>()
  private announcedPrimary = new Set<string>()
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

  /** complete() keeps its own loop on purpose: attempts run through
   * executeWithStrategy (per-provider retries with index backoff, then model
   * fallbacks) and the terminal error carries the last failure's category.
   * Delegating to withActiveProviders would run model fallbacks twice. */
  async complete(request: LLMRequest): Promise<LLMResponse> {
    const errors: string[] = []
    const active = this.requireActiveProviders()

    for (let i = 0; i < active.length; i++) {
      const provider = active[i]
      const name = this.providerName(provider)
      const breaker = this.circuitBreakers.get(name)!

      if (breaker.state === 'OPEN') {
        continue
      }

      this.announce(name, i === 0)

      try {
        const result = await this.executeWithStrategy(provider, request, i)
        this.onSuccess(name)
        return result
      } catch (err) {
        this.recordProviderFailure(name, err, errors)

        if (i === active.length - 1) {
          console.info(`All providers exhausted`)
          throw new AllProvidersFailedError(errors, classifyError(err).category)
        }
      }
    }

    throw new AllProvidersFailedError(errors)
  }

  async stream(request: LLMRequest): Promise<AsyncGenerator<LLMChunk>> {
    return this.withActiveProviders(async (provider) => {
      const gen = await provider.stream(request)
      const first = await gen.next()
      if (first.done) return emptyGenerator()
      return firstChunkGenerator(first.value, gen)
    })
  }

  async embed(text: string): Promise<number[]> {
    return this.withActiveProviders(async (provider) => provider.embed(text))
  }

  /**
   * Shared failover loop for stream/embed. Iterates active providers,
   * tries each with model fallbacks, and handles breaker tripping.
   */
  private async withActiveProviders<T>(
    attempt: (provider: ILLMProvider, name: string) => Promise<T>,
  ): Promise<T> {
    const errors: string[] = []
    const active = this.requireActiveProviders()

    for (const provider of active) {
      const name = this.providerName(provider)
      const breaker = this.circuitBreakers.get(name)!

      if (breaker.state === 'OPEN') continue

      this.announce(name, errors.length === 0)

      try {
        const result = await attempt(provider, name)
        this.onSuccess(name)
        return result
      } catch (err) {
        try {
          const result = await this.tryRemainingModels(provider, name, () => attempt(provider, name), err)
          this.onSuccess(name)
          return result
        } catch (finalError) {
          this.recordProviderFailure(name, finalError, errors)
        }
      }
    }

    console.info('All providers exhausted')
    throw new AllProvidersFailedError(errors)
  }

  private recordProviderFailure(name: string, err: unknown, errors: string[]): void {
    const classified = classifyError(err)
    const msg = err instanceof Error ? err.message : String(err)
    errors.push(`${name}: ${msg}`)

    if (classified.permanent) {
      this.tripBreaker(name, Infinity)
    } else if (classified.retryable) {
      this.tripBreaker(name, classified.cooldownMs)
    }
  }

  /** Permanent failures other than a missing model end the fallback walk. */
  private static isHardStop(classified: ReturnType<typeof classifyError>): boolean {
    return classified.permanent && classified.category !== 'model_not_found'
  }

  /** Shared model-fallback path: re-attempt on each remaining model until one
   * succeeds or a hard-stop failure ends the walk; throws the last error. */
  private async tryRemainingModels<T>(
    provider: ILLMProvider,
    name: string,
    attempt: () => Promise<T>,
    firstError: unknown,
  ): Promise<T> {
    let lastError = firstError
    if (!ProviderChain.isHardStop(classifyError(firstError))) {
      for (const model of this.modelMap.get(name)?.slice(1) ?? []) {
        try {
          provider.setModel(model)
          return await attempt()
        } catch (err) {
          lastError = err
          if (ProviderChain.isHardStop(classifyError(err))) break
        }
      }
    }
    throw lastError
  }

  /** Test-only construction helper — production chains are assembled by
   * LLMRouter.buildChainFromEntries, which owns config and redaction wiring. */
  static buildChain(
    providers: Map<string, ILLMProvider>,
    preferred: string,
    fallbackOrder: string[],
    modelMap?: Map<string, string[]>,
  ): { chain: ProviderChain; names: string[] } {
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

  private completeWithTimeout(provider: ILLMProvider, request: LLMRequest): Promise<LLMResponse> {
    const ms = this.chainConfig.requestTimeoutMs ?? 60_000
    let timer: ReturnType<typeof setTimeout>
    return Promise.race([
      provider.complete(request).finally(() => clearTimeout(timer)),
      new Promise<LLMResponse>((_, reject) => {
        timer = setTimeout(() => reject(new TimeoutError(this.providerName(provider))), ms)
        timer.unref()
      }),
    ])
  }

  private async executeWithStrategy(
    provider: ILLMProvider,
    request: LLMRequest,
    index: number,
  ): Promise<LLMResponse> {
    let lastError: unknown

    // cheap failover — 250ms base, capped, so 5-provider chain stays well under 60s Vercel budget
    for (let retry = 0; retry < 2; retry++) {
      try {
        if (retry > 0) {
          await sleep(250 * Math.pow(2, retry - 1 + Math.min(index, 1)))
        }
        return await this.completeWithTimeout(provider, request)
      } catch (err) {
        lastError = err
        if (ProviderChain.isHardStop(classifyError(err))) throw err
      }
    }

    return this.tryRemainingModels(
      provider,
      this.providerName(provider),
      () => this.completeWithTimeout(provider, request),
      lastError,
    )
  }

  private onSuccess(name: string): void {
    const breaker = this.circuitBreakers.get(name)
    if (!breaker) return
    breaker.state = 'CLOSED'
    breaker.failureCount = 0
    breaker.cooldownUntil = 0
    breaker.probeScheduledAt = 0
  }

  private tripBreaker(name: string, cooldownMs: number): void {
    const breaker = this.circuitBreakers.get(name)
    if (!breaker) return

    breaker.failureCount++

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

  private requireActiveProviders(): ILLMProvider[] {
    const active = this.computeActiveProviders()
    if (active.length === 0) {
      throw new AllProvidersFailedError(['all providers in OPEN state'], 'unavailable')
    }
    return active
  }

  private computeActiveProviders(): ILLMProvider[] {
    for (const [, breaker] of this.circuitBreakers) {
      if (breaker.state !== 'OPEN') continue

      const probeEnabled = this.chainConfig.probeEnabled ?? true
      if (probeEnabled && breaker.probeScheduledAt > 0 && Date.now() >= breaker.probeScheduledAt) {
        breaker.state = 'HALF_OPEN'
        breaker.probeScheduledAt = 0
        continue
      }

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

  /**
   * Announces a provider transition exactly once. The "Using X (primary)"
   * line is emitted a single time per chain instance; fallbacks stay
   * per-call so operator logs show every hop without 20 identical lines.
   */
  private announce(name: string, isPrimary: boolean): void {
    if (isPrimary) {
      if (this.announcedPrimary.has(name)) return
      this.announcedPrimary.add(name)
      console.info(`Using ${name} (primary)`)
      return
    }
    console.info(`${name} failed, falling back to next provider`)
  }

  private freshState(): CircuitBreakerState {
    return { state: 'CLOSED', failureCount: 0, cooldownUntil: 0, probeScheduledAt: 0 }
  }

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

function emptyGenerator(): AsyncGenerator<LLMChunk> {
  return (async function* () {})()
}

function firstChunkGenerator(
  first: LLMChunk,
  rest: AsyncGenerator<LLMChunk>,
): AsyncGenerator<LLMChunk> {
  return (async function* () {
    yield first
    yield* rest
  })()
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
