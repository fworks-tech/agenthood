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

import type { ILLMProvider } from './ILLMProvider.js'
import type { LLMRequest, LLMResponse, LLMChunk } from './types.js'
import type { ProviderChainConfig } from './providerFailoverTypes.ts'
import type { CircuitBreakerState } from './providerFailoverTypes.ts'
import { classifyError, AllProvidersFailedError } from './ProviderFailoverError.js'
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

      console.info(i === 0 ? `Using ${name} (primary)` : `${errors[errors.length - 1]?.split(':')[0] ?? 'previous'} failed, falling back to ${name}`)

      try {
        const result = await this.executeWithStrategy(provider, request, i)
        this.onSuccess(name)
        return result
      } catch (err) {
        const classified = classifyError(err)
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`${name}: ${msg}`)

        if (classified.permanent) {
          this.tripBreaker(name, Infinity)
        } else if (classified.retryable) {
          this.tripBreaker(name, classified.cooldownMs)
        }

        if (i === active.length - 1) {
          console.info(`All providers exhausted`)
          throw new AllProvidersFailedError(errors, classified.category)
        }
      }
    }

    throw new AllProvidersFailedError(errors)
  }

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

      console.info(errors.length === 0 ? `Using ${name} (primary)` : `${errors[errors.length - 1]?.split(':')[0] ?? 'previous'} failed, falling back to ${name}`)

      const models = this.modelMap.get(name)
      const fallbackModels = models && models.length > 1 ? models.slice(1) : undefined
      let lastError: unknown

      for (let attempt = 0; attempt <= (fallbackModels?.length ?? 0); attempt++) {
        if (attempt > 0 && fallbackModels) {
          provider.setModel(fallbackModels[attempt - 1])
        }

        try {
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

    console.info('All providers exhausted')
    throw new AllProvidersFailedError(errors)
  }

  async embed(text: string): Promise<number[]> {
    const errors: string[] = []
    const active = this.activeProviders()

    for (const provider of active) {
      const name = this.providerName(provider)

      console.info(errors.length === 0 ? `Using ${name} (primary)` : `${errors[errors.length - 1]?.split(':')[0] ?? 'previous'} failed, falling back to ${name}`)

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

    console.info('All providers exhausted')
    throw new AllProvidersFailedError(errors)
  }

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

  private async executeWithStrategy(
    provider: ILLMProvider,
    request: LLMRequest,
    index: number,
  ): Promise<LLMResponse> {
    let lastError: unknown

    for (let retry = 0; retry < 3; retry++) {
      try {
        if (retry > 0) {
          await sleep(1000 * Math.pow(2, retry - 1 + index))
        }
        return await provider.complete(request)
      } catch (err) {
          lastError = err
          const classified = classifyError(err)
          if (classified.permanent && classified.category !== 'model_not_found') throw err
      }
    }

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

  private activeProviders(): ILLMProvider[] {
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
