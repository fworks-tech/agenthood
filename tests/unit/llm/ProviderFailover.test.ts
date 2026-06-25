import { describe, it, expect, vi } from 'vitest'
import {
  ProviderChain,
  AllProvidersFailedError,
  classifyError,
} from '../../../src/llm/ProviderFailover.js'
import {
  AuthError,
  PaymentRequiredError,
  RateLimitedError,
  TimeoutError,
  ServiceUnavailableError,
  ModelNotFoundError,
} from '../../../src/llm/errors.js'
import type { ILLMProvider } from '../../../src/llm/ILLMProvider.js'

function mockProvider(label: string, shouldFail?: boolean, models?: string[]): ILLMProvider {
  let currentModel = models?.[0] ?? `${label}-model`
  return {
    complete: vi.fn().mockImplementation(async () => {
      if (shouldFail) throw new Error(`${label} failed`)
      return {
        content: `${label} response`,
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        model: currentModel,
      }
    }),
    stream: vi.fn().mockImplementation(async function* () {
      if (shouldFail) throw new Error(`${label} failed`)
      yield { delta: `${label} chunk`, done: false }
      yield { delta: '', done: true }
    }),
    embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    getContextWindow: () => 8192,
    setModel: vi.fn().mockImplementation((m: string) => { currentModel = m }),
  }
}

function mockErrorProvider(error: Error): ILLMProvider {
  return {
    complete: vi.fn().mockRejectedValue(error),
    stream: vi.fn().mockRejectedValue(error),
    embed: vi.fn().mockRejectedValue(error),
    getContextWindow: () => 8192,
    setModel: vi.fn(),
  }
}

describe('classifyError', () => {
  it('classifies AuthError as permanent auth', () => {
    const c = classifyError(new AuthError('test'))
    expect(c.category).toBe('auth')
    expect(c.permanent).toBe(true)
    expect(c.retryable).toBe(false)
  })

  it('classifies PaymentRequiredError as permanent payment', () => {
    const c = classifyError(new PaymentRequiredError('test'))
    expect(c.category).toBe('payment')
    expect(c.permanent).toBe(true)
  })

  it('classifies RateLimitedError as retryable rate_limited', () => {
    const c = classifyError(new RateLimitedError('test', 120))
    expect(c.category).toBe('rate_limited')
    expect(c.retryable).toBe(true)
    expect(c.retryAfter).toBe(120)
    expect(c.cooldownMs).toBe(120_000)
  })

  it('classifies TimeoutError as retryable timeout', () => {
    const c = classifyError(new TimeoutError('test'))
    expect(c.category).toBe('timeout')
    expect(c.retryable).toBe(true)
    expect(c.retryAfter).toBe(30)
    expect(c.cooldownMs).toBe(30_000)
  })

  it('classifies ServiceUnavailableError as retryable unavailable', () => {
    const c = classifyError(new ServiceUnavailableError('test'))
    expect(c.category).toBe('unavailable')
    expect(c.retryable).toBe(true)
    expect(c.retryAfter).toBe(60)
    expect(c.cooldownMs).toBe(60_000)
  })

  it('classifies ModelNotFoundError as permanent model_not_found', () => {
    const c = classifyError(new ModelNotFoundError('test', 'foo'))
    expect(c.category).toBe('model_not_found')
    expect(c.permanent).toBe(true)
    expect(c.retryable).toBe(false)
  })

  it('classifies generic Error as unknown', () => {
    const c = classifyError(new Error('something broke'))
    expect(c.category).toBe('unknown')
    expect(c.retryable).toBe(false)
  })

  it('classifies HTTP status embedded in message', () => {
    const c = classifyError(new Error('HTTP 429 Too Many Requests'))
    expect(c.category).toBe('rate_limited')

    const c2 = classifyError(new Error('status 503 service unavailable'))
    expect(c2.category).toBe('unavailable')

    const c3 = classifyError(new Error('401 unauthorized'))
    expect(c3.category).toBe('auth')
  })
})

describe('ProviderChain', () => {
  it('returns first provider response when it works', async () => {
    const p1 = mockProvider('first')
    const chain = new ProviderChain([p1], ['first'])

    const result = await chain.complete({ messages: [{ role: 'user', content: 'hello' }] })
    expect(result.content).toBe('first response')
  })

  it('fails over to next provider when first fails', async () => {
    const p1 = mockProvider('first', true)
    const p2 = mockProvider('second')
    const chain = new ProviderChain([p1, p2], ['first', 'second'])

    const result = await chain.complete({ messages: [{ role: 'user', content: 'hello' }] })
    expect(result.content).toBe('second response')
  })

  it('throws AllProvidersFailedError when all fail', async () => {
    const p1 = mockProvider('p1', true)
    const p2 = mockProvider('p2', true)
    const chain = new ProviderChain([p1, p2], ['p1', 'p2'])

    await expect(
      chain.complete({ messages: [{ role: 'user', content: 'hello' }] }),
    ).rejects.toThrow(AllProvidersFailedError)
  }, 15000)

  it('trips circuit breaker on permanent error', async () => {
    const p1 = mockErrorProvider(new AuthError('bad key'))
    const p2 = mockProvider('backup')
    const chain = new ProviderChain([p1, p2], ['primary', 'backup'])

    const result = await chain.complete({ messages: [{ role: 'user', content: 'hello' }] })
    expect(result.content).toBe('backup response')

    // Primary should now be OPEN
    const state = chain.getBreakerState('primary')!
    expect(state.state).toBe('OPEN')
  })

  it('buildChain creates ordered provider chain from preferred + fallback', () => {
    const providers = new Map<string, ILLMProvider>([
      ['anthropic', mockProvider('anthropic')],
      ['groq', mockProvider('groq')],
      ['ollama', mockProvider('ollama')],
    ])

    const { chain, names } = ProviderChain.buildChain(providers, 'anthropic', ['groq', 'ollama'])

    expect(names).toEqual(['anthropic', 'groq', 'ollama'])
    expect(chain).toBeInstanceOf(ProviderChain)
  })

  it('buildChain passes modelMap to constructed chain', () => {
    const providers = new Map<string, ILLMProvider>([
      ['anthropic', mockProvider('anthropic', false, ['sonnet', 'haiku'])],
      ['groq', mockProvider('groq')],
    ])
    const modelMap = new Map([['anthropic', ['sonnet', 'haiku']]])

    const { chain } = ProviderChain.buildChain(providers, 'anthropic', ['groq'], modelMap)

    expect(chain.modelMap.get('anthropic')).toEqual(['sonnet', 'haiku'])
  })

  it('stream fails over to next provider', async () => {
    const p1 = mockProvider('first', true)
    const p2 = mockProvider('second')
    const chain = new ProviderChain([p1, p2], ['first', 'second'])

    const gen = await chain.stream({ messages: [{ role: 'user', content: 'hello' }] })
    const chunks: string[] = []
    for await (const chunk of gen) {
      chunks.push(chunk.delta)
    }
    expect(chunks.join('')).toBe('second chunk')
  })

  it('stream throws when all providers fail', async () => {
    const p1 = mockProvider('p1', true)
    const p2 = mockProvider('p2', true)
    const chain = new ProviderChain([p1, p2], ['p1', 'p2'])

    await expect(
      chain.stream({ messages: [{ role: 'user', content: 'hello' }] }),
    ).rejects.toThrow(AllProvidersFailedError)
  })

  describe('model downgrade (Strategy 4)', () => {
    it('downgrades to fallback model when first model fails', async () => {
      const modelErrors = new Map<string, Error>()
      let currentModel = 'sonnet'
      const provider = {
        complete: vi.fn().mockImplementation(async () => {
          if (modelErrors.has(currentModel)) throw modelErrors.get(currentModel)!
          return {
            content: `${currentModel} response`,
            usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
            model: currentModel,
          }
        }),
        stream: vi.fn(),
        embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
        getContextWindow: () => 8192,
        setModel: vi.fn().mockImplementation((m: string) => { currentModel = m }),
      }
      modelErrors.set('sonnet', new Error('model overloaded'))

      const modelMap = new Map([['anthropic', ['sonnet', 'haiku']]])
      const chain = new ProviderChain([provider], ['anthropic'], undefined, modelMap)

      const result = await chain.complete({ messages: [{ role: 'user', content: 'hello' }] })

      expect(result.content).toBe('haiku response')
      expect(provider.setModel).toHaveBeenCalledWith('haiku')
    })

    it('throws when all models on a provider fail', async () => {
      const modelErrors = new Map<string, Error>()
      let currentModel = 'sonnet'
      const provider = {
        complete: vi.fn().mockImplementation(async () => {
          throw modelErrors.get(currentModel) ?? new Error('failed')
        }),
        stream: vi.fn(),
        embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
        getContextWindow: () => 8192,
        setModel: vi.fn().mockImplementation((m: string) => { currentModel = m }),
      }
      modelErrors.set('sonnet', new Error('sonnet failed'))
      modelErrors.set('haiku', new Error('haiku failed'))

      const modelMap = new Map([['anthropic', ['sonnet', 'haiku']]])
      const chain = new ProviderChain([provider], ['anthropic'], undefined, modelMap)

      await expect(
        chain.complete({ messages: [{ role: 'user', content: 'hello' }] }),
      ).rejects.toThrow(AllProvidersFailedError)
    })

    it('skips model downgrade when no modelMap is provided', async () => {
      const p1 = mockProvider('p1', true)
      const p2 = mockProvider('p2')
      const chain = new ProviderChain([p1, p2], ['p1', 'p2'])

      const result = await chain.complete({ messages: [{ role: 'user', content: 'hello' }] })
      expect(result.content).toBe('p2 response')
    })

    it('skips model downgrade when modelMap has no fallback models', async () => {
      const primary = mockProvider('primary', true, ['only-model'])
      const backup = mockProvider('backup')
      const modelMap = new Map([['primary', ['only-model']]])

      const chain = new ProviderChain([primary, backup], ['primary', 'backup'], undefined, modelMap)

      const result = await chain.complete({ messages: [{ role: 'user', content: 'hello' }] })
      expect(result.content).toBe('backup response')
    })

    it('fails over to next provider on stream when all models fail', async () => {
      const modelErrors = new Map<string, Error>()
      let currentModel = 'sonnet'
      const provider = {
        complete: vi.fn(),
        stream: vi.fn().mockImplementation(async function* () {
          if (modelErrors.has(currentModel)) throw modelErrors.get(currentModel)!
          yield { delta: `${currentModel} chunk`, done: false }
          yield { delta: '', done: true }
        }),
        embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
        getContextWindow: () => 8192,
        setModel: vi.fn().mockImplementation((m: string) => { currentModel = m }),
      }
      modelErrors.set('sonnet', new Error('sonnet failed'))
      modelErrors.set('haiku', new Error('haiku failed'))

      const modelMap = new Map([['anthropic', ['sonnet', 'haiku']]])
      const backup = mockProvider('backup')

      const chain = new ProviderChain([provider, backup], ['anthropic', 'backup'], undefined, modelMap)

      const gen = await chain.stream({ messages: [{ role: 'user', content: 'hello' }] })
      const chunks: string[] = []
      for await (const chunk of gen) {
        chunks.push(chunk.delta)
      }
      expect(chunks.join('')).toBe('backup chunk')
    }, 15000)

    it('downgrades model on stream when primary model fails', async () => {
      const modelErrors = new Map<string, Error>()
      let currentModel = 'sonnet'
      const provider = {
        complete: vi.fn(),
        stream: vi.fn().mockImplementation(async function* () {
          if (modelErrors.has(currentModel)) throw modelErrors.get(currentModel)!
          yield { delta: `${currentModel} chunk`, done: false }
          yield { delta: '', done: true }
        }),
        embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
        getContextWindow: () => 8192,
        setModel: vi.fn().mockImplementation((m: string) => { currentModel = m }),
      }
      modelErrors.set('sonnet', new Error('model overloaded'))

      const modelMap = new Map([['anthropic', ['sonnet', 'haiku']]])
      const backup = mockProvider('backup')
      const chain = new ProviderChain([provider, backup], ['anthropic', 'backup'], undefined, modelMap)

      const gen = await chain.stream({ messages: [{ role: 'user', content: 'hello' }] })
      const chunks: string[] = []
      for await (const chunk of gen) {
        chunks.push(chunk.delta)
      }
      expect(chunks.join('')).toBe('haiku chunk')
      expect(provider.setModel).toHaveBeenCalledWith('haiku')
    })

    it('downgrades model on complete when primary throws ModelNotFoundError', async () => {
      const modelErrors = new Map<string, Error>()
      let currentModel = 'sonnet'
      const provider = {
        complete: vi.fn().mockImplementation(async () => {
          if (modelErrors.has(currentModel)) throw modelErrors.get(currentModel)!
          return {
            content: `${currentModel} response`,
            usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
            model: currentModel,
          }
        }),
        stream: vi.fn(),
        embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
        getContextWindow: () => 8192,
        setModel: vi.fn().mockImplementation((m: string) => { currentModel = m }),
      }
      modelErrors.set('sonnet', new ModelNotFoundError('sonnet removed', 'sonnet'))

      const modelMap = new Map([['anthropic', ['sonnet', 'haiku']]])
      const chain = new ProviderChain([provider], ['anthropic'], undefined, modelMap)

      const result = await chain.complete({ messages: [{ role: 'user', content: 'hello' }] })
      expect(result.content).toBe('haiku response')
      expect(provider.setModel).toHaveBeenCalledWith('haiku')
    })

    it('downgrades model on stream when primary throws ModelNotFoundError', async () => {
      const modelErrors = new Map<string, Error>()
      let currentModel = 'sonnet'
      const provider = {
        complete: vi.fn(),
        stream: vi.fn().mockImplementation(async function* () {
          if (modelErrors.has(currentModel)) throw modelErrors.get(currentModel)!
          yield { delta: `${currentModel} chunk`, done: false }
          yield { delta: '', done: true }
        }),
        embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
        getContextWindow: () => 8192,
        setModel: vi.fn().mockImplementation((m: string) => { currentModel = m }),
      }
      modelErrors.set('sonnet', new ModelNotFoundError('sonnet removed', 'sonnet'))

      const modelMap = new Map([['anthropic', ['sonnet', 'haiku']]])
      const chain = new ProviderChain([provider], ['anthropic'], undefined, modelMap)

      const gen = await chain.stream({ messages: [{ role: 'user', content: 'hello' }] })
      const chunks: string[] = []
      for await (const chunk of gen) {
        chunks.push(chunk.delta)
      }
      expect(chunks.join('')).toBe('haiku chunk')
      expect(provider.setModel).toHaveBeenCalledWith('haiku')
    })

    it('downgrades model on embed when primary throws ModelNotFoundError', async () => {
      let currentModel = 'sonnet'
      const provider = {
        complete: vi.fn(),
        stream: vi.fn(),
        embed: vi.fn().mockImplementation(async () => {
          if (currentModel === 'sonnet') throw new ModelNotFoundError('sonnet removed', 'sonnet')
          return [0.5, 0.6, 0.7]
        }),
        getContextWindow: () => 8192,
        setModel: vi.fn().mockImplementation((m: string) => { currentModel = m }),
      }

      const modelMap = new Map([['anthropic', ['sonnet', 'haiku']]])
      const chain = new ProviderChain([provider], ['anthropic'], undefined, modelMap)

      const result = await chain.embed('test text')
      expect(result).toEqual([0.5, 0.6, 0.7])
      expect(provider.setModel).toHaveBeenCalledWith('haiku')
    })

    it('trips embed provider permanently on AuthError instead of hardcoded 60s', async () => {
      let currentModel = 'sonnet'
      const provider = {
        complete: vi.fn(),
        stream: vi.fn(),
        embed: vi.fn().mockImplementation(async () => {
          throw new AuthError('bad key')
        }),
        getContextWindow: () => 8192,
        setModel: vi.fn().mockImplementation((m: string) => { currentModel = m }),
      }
      const backup = mockProvider('backup')

      const chain = new ProviderChain([provider, backup], ['primary', 'backup'], undefined)

      await chain.embed('test text')

      // Should be OPEN with Infinity cooldown, not 60_000
      const state = chain.getBreakerState('primary')!
      expect(state.state).toBe('OPEN')
      expect(state.cooldownUntil).toBe(Infinity)
    })

    it('downgrades model on embed when primary model fails', async () => {
      let currentModel = 'sonnet'
      const provider = {
        complete: vi.fn(),
        stream: vi.fn(),
        embed: vi.fn().mockImplementation(async () => {
          if (currentModel === 'sonnet') throw new Error('sonnet embedding failed')
          return [0.5, 0.6, 0.7]
        }),
        getContextWindow: () => 8192,
        setModel: vi.fn().mockImplementation((m: string) => { currentModel = m }),
      }

      const modelMap = new Map([['anthropic', ['sonnet', 'haiku']]])
      const chain = new ProviderChain([provider], ['anthropic'], undefined, modelMap)

      const result = await chain.embed('test text')
      expect(result).toEqual([0.5, 0.6, 0.7])
      expect(provider.setModel).toHaveBeenCalledWith('haiku')
    })

    it('downgrades before failing over to next provider in chain', async () => {
      const modelErrors = new Map<string, Error>()
      let currentModel = 'sonnet'
      const primary = {
        complete: vi.fn().mockImplementation(async () => {
          if (modelErrors.has(currentModel)) throw modelErrors.get(currentModel)!
          return {
            content: `${currentModel} response`,
            usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
            model: currentModel,
          }
        }),
        stream: vi.fn(),
        embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
        getContextWindow: () => 8192,
        setModel: vi.fn().mockImplementation((m: string) => { currentModel = m }),
      }
      modelErrors.set('sonnet', new Error('sonnet failed'))

      const backup = mockProvider('groq')

      const modelMap = new Map([['anthropic', ['sonnet', 'haiku']]])
      const chain = new ProviderChain([primary, backup], ['anthropic', 'groq'], undefined, modelMap)

      const result = await chain.complete({ messages: [{ role: 'user', content: 'hello' }] })
      expect(result.content).toBe('haiku response')
      expect(primary.setModel).toHaveBeenCalledWith('haiku')
      expect(backup.complete).not.toHaveBeenCalled()
    })
  })

  describe('circuit breaker config', () => {
    it('respects failureThreshold', async () => {
      const p1 = mockErrorProvider(new TimeoutError('test'))
      const p2 = mockProvider('p2')
      const chain = new ProviderChain([p1, p2], ['p1', 'p2'], { failureThreshold: 3 })

      // First call: failureCount = 1, threshold = 3 -> stays CLOSED
      await chain.complete({ messages: [{ role: 'user', content: 'hello' }] })
      let state = chain.getBreakerState('p1')!
      expect(state.state).toBe('CLOSED')
      expect(state.failureCount).toBe(1)

      // Second call: failureCount = 2, still CLOSED
      await chain.complete({ messages: [{ role: 'user', content: 'hello' }] })
      state = chain.getBreakerState('p1')!
      expect(state.state).toBe('CLOSED')
      expect(state.failureCount).toBe(2)

      // Third call: failureCount = 3 -> trips to OPEN
      await chain.complete({ messages: [{ role: 'user', content: 'hello' }] })
      state = chain.getBreakerState('p1')!
      expect(state.state).toBe('OPEN')
      expect(state.failureCount).toBe(3)
    }, 15000)

    it('resets failureCount on success', async () => {
      let callCount = 0
      const p1 = {
        complete: vi.fn().mockImplementation(async () => {
          callCount++
          if (callCount <= 3) throw new TimeoutError('test')
          return { content: 'ok', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }, model: 'm' }
        }),
        stream: vi.fn(),
        embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
        getContextWindow: () => 8192,
        setModel: vi.fn(),
      }
      const p2 = mockProvider('p2')
      const chain = new ProviderChain([p1, p2], ['p1', 'p2'], { failureThreshold: 3 })

      // First complete() call: p1's executeWithStrategy retries (2 calls total),
      // both fail with TimeoutError -> tripBreaker runs once -> failureCount = 1
      await chain.complete({ messages: [{ role: 'user', content: 'hello' }] })
      expect(chain.getBreakerState('p1')!.failureCount).toBe(1)

      // Second complete() call: p1 fails 2 more times (callCount 3,4) -> failureCount = 2,3
      // then succeeds on callCount 5
      await chain.complete({ messages: [{ role: 'user', content: 'hello' }] })
      expect(chain.getBreakerState('p1')!.failureCount).toBe(0)
      expect(chain.getBreakerState('p1')!.state).toBe('CLOSED')
    })

    it('uses configured cooldownMs instead of error cooldown', async () => {
      const p1 = mockErrorProvider(new TimeoutError('test'))
      const p2 = mockProvider('backup')
      const chain = new ProviderChain([p1, p2], ['primary', 'backup'], { cooldownMs: 5000 })

      await chain.complete({ messages: [{ role: 'user', content: 'hello' }] })

      const state = chain.getBreakerState('primary')!
      expect(state.state).toBe('OPEN')
      // Cooldown should be 5000, not the default 30000 for TimeoutError
      expect(state.cooldownUntil).toBeLessThan(Date.now() + 10000)
    })

    it('trips immediately on permanent error regardless of failureThreshold', async () => {
      const p1 = mockErrorProvider(new AuthError('bad key'))
      const p2 = mockProvider('backup')
      const chain = new ProviderChain([p1, p2], ['primary', 'backup'], { failureThreshold: 5 })

      await chain.complete({ messages: [{ role: 'user', content: 'hello' }] })

      const state = chain.getBreakerState('primary')!
      expect(state.state).toBe('OPEN')
      expect(state.failureCount).toBe(1)
    })

    it('disables probe recovery when probeEnabled is false', async () => {
      const p1 = mockErrorProvider(new TimeoutError('test'))
      const p2 = mockProvider('backup')
      const chain = new ProviderChain([p1, p2], ['primary', 'backup'], {
        cooldownMs: 60_000,
        probeEnabled: false,
      })

      await chain.complete({ messages: [{ role: 'user', content: 'hello' }] })

      const state = chain.getBreakerState('primary')!
      expect(state.probeScheduledAt).toBe(0)
    })
  })

  describe('HALF_OPEN probe recovery', () => {
    it('recovers via cooldown expiry when probeEnabled is false', async () => {
      const p1 = mockErrorProvider(new TimeoutError('test'))
      const p2 = mockProvider('backup')
      const chain = new ProviderChain([p1, p2], ['primary', 'backup'], {
        cooldownMs: 50,
        probeEnabled: false,
      })

      // First call: primary fails -> OPEN (probeScheduledAt = 0)
      await chain.complete({ messages: [{ role: 'user', content: 'hello' }] })
      expect(chain.getBreakerState('primary')!.probeScheduledAt).toBe(0)

      // Wait for cooldown to expire
      await new Promise((r) => setTimeout(r, 100))

      // Second call: cooldown expiry -> HALF_OPEN -> primary is tried again -> fails
      await chain.complete({ messages: [{ role: 'user', content: 'hello' }] })
      expect(chain.getBreakerState('primary')!.state).toBe('OPEN')
      expect(chain.getBreakerState('primary')!.failureCount).toBe(2)
    }, 15000)

    it('transitions to HALF_OPEN when cooldown expires', async () => {
      const p1 = mockErrorProvider(new TimeoutError('test'))
      const p2 = mockProvider('backup')
      const chain = new ProviderChain([p1, p2], ['primary', 'backup'], { cooldownMs: 50 })

      await chain.complete({ messages: [{ role: 'user', content: 'hello' }] })
      expect(chain.getBreakerState('primary')!.state).toBe('OPEN')

      // Wait for cooldown to expire
      await new Promise((r) => setTimeout(r, 100))

      // activeProviders() should transition primary to HALF_OPEN.
      // The HALF_OPEN attempt will fail (mockErrorProvider always fails),
      // tripping breaker back to OPEN. But we can verify the transition
      // by checking the breaker state was HALF_OPEN at some point.
      // Instead, verify that primary was tried again (not skipped as OPEN):
      // after cooldown, primary gets a chance and fails again.
      await chain.complete({ messages: [{ role: 'user', content: 'hello' }] })
      // Now primary should be OPEN again (HALF_OPEN attempt failed)
      expect(chain.getBreakerState('primary')!.state).toBe('OPEN')
      // failureCount is 2 because it was tried twice now
      expect(chain.getBreakerState('primary')!.failureCount).toBe(2)
    }, 15000)

    it('restores to CLOSED on successful probe', async () => {
      let phase: 'initial' | 'probe' = 'initial'
      const p1 = {
        complete: vi.fn().mockImplementation(async () => {
          if (phase === 'initial') throw new TimeoutError('test')
          return {
            content: 'recovered response',
            usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
            model: 'recovered',
          }
        }),
        stream: vi.fn(),
        embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
        getContextWindow: () => 8192,
        setModel: vi.fn(),
      }
      const p2 = mockProvider('backup')
      const chain = new ProviderChain([p1, p2], ['primary', 'backup'], { cooldownMs: 50 })

      // First call: executeWithStrategy calls p1 twice (both fail) -> OPEN
      await chain.complete({ messages: [{ role: 'user', content: 'hello' }] })
      expect(chain.getBreakerState('primary')!.state).toBe('OPEN')

      // Switch to probe mode so p1 will succeed
      phase = 'probe'

      // Wait for cooldown to expire
      await new Promise((r) => setTimeout(r, 100))

      // Second call: activeProviders() transitions to HALF_OPEN,
      // executeWithStrategy tries p1 (both Strategy 1 + 2 succeed) -> CLOSED
      const result = await chain.complete({ messages: [{ role: 'user', content: 'hello' }] })
      expect(result.content).toBe('recovered response')
      expect(chain.getBreakerState('primary')!.state).toBe('CLOSED')
    })
  })
})
