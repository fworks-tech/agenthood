import { describe, it, expect } from 'vitest'
import { classifyError } from '../../../src/llm/ProviderFailover.ts'
import {
  AuthError,
  PaymentRequiredError,
  RateLimitedError,
  TimeoutError,
  ServiceUnavailableError,
  ModelNotFoundError,
} from '../../../src/llm/errors.ts'

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

  it('classifies HTTP 400 as permanent bad_request', () => {
    const c = classifyError(new Error('400 Error from provider (Console Go): Upstream request failed'))
    expect(c.category).toBe('bad_request')
    expect(c.permanent).toBe(true)
    expect(c.retryable).toBe(false)
  })
})
