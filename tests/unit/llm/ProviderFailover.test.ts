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

function mockProvider(label: string, shouldFail?: boolean): ILLMProvider {
  return {
    complete: vi.fn().mockImplementation(async () => {
      if (shouldFail) throw new Error(`${label} failed`)
      return {
        content: `${label} response`,
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        model: `${label}-model`,
      }
    }),
    stream: vi.fn().mockImplementation(async function* () {
      if (shouldFail) throw new Error(`${label} failed`)
      yield { delta: `${label} chunk`, done: false }
      yield { delta: '', done: true }
    }),
    embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  }
}

function mockErrorProvider(error: Error): ILLMProvider {
  return {
    complete: vi.fn().mockRejectedValue(error),
    stream: vi.fn().mockRejectedValue(error),
    embed: vi.fn().mockRejectedValue(error),
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
  })

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
})
