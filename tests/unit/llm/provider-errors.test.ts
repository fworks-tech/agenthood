import { describe, it, expect } from 'vitest'
import { mapProviderError } from '../../../src/llm/providers/provider-errors.js'
import {
  AuthError,
  RateLimitedError,
  TimeoutError,
  ServiceUnavailableError,
  ModelNotFoundError,
} from '../../../src/llm/errors.js'

function httpError(status: number, headers?: Record<string, string>): Error {
  const err = new Error(`http ${status}`) as Error & { status?: number; headers?: Record<string, string> }
  err.status = status
  if (headers) err.headers = headers
  return err
}

describe('mapProviderError', () => {
  it('maps 401 to AuthError with provider name', () => {
    const result = mapProviderError(httpError(401), 'openai', 'gpt-5.4')
    expect(result).toBeInstanceOf(AuthError)
    expect(result.message).toContain('openai')
  })

  it('maps 404 to ModelNotFoundError with provider and model', () => {
    const result = mapProviderError(httpError(404), 'openai', 'gpt-5.4')
    expect(result).toBeInstanceOf(ModelNotFoundError)
    expect(result.message).toContain('gpt-5.4')
  })

  it('maps 408 to TimeoutError', () => {
    expect(mapProviderError(httpError(408), 'openai', 'gpt-5.4')).toBeInstanceOf(TimeoutError)
  })

  it('maps 504 to TimeoutError', () => {
    expect(mapProviderError(httpError(504), 'openai', 'gpt-5.4')).toBeInstanceOf(TimeoutError)
  })

  it('maps 5xx to ServiceUnavailableError', () => {
    expect(mapProviderError(httpError(500), 'openai', 'gpt-5.4')).toBeInstanceOf(ServiceUnavailableError)
    expect(mapProviderError(httpError(502), 'openai', 'gpt-5.4')).toBeInstanceOf(ServiceUnavailableError)
    expect(mapProviderError(httpError(503), 'openai', 'gpt-5.4')).toBeInstanceOf(ServiceUnavailableError)
    expect(mapProviderError(httpError(599), 'openai', 'gpt-5.4')).toBeInstanceOf(ServiceUnavailableError)
  })

  it('maps 429 with numeric retry-after to RateLimitedError preserving the value', () => {
    const result = mapProviderError(httpError(429, { 'retry-after': '15' }), 'groq', 'llama-3.3')
    expect(result).toBeInstanceOf(RateLimitedError)
    expect((result as RateLimitedError).retryAfter).toBe(15)
  })

  it('falls back to 60 seconds when retry-after is missing', () => {
    const result = mapProviderError(httpError(429), 'groq', 'llama-3.3')
    expect((result as RateLimitedError).retryAfter).toBe(60)
  })

  it('falls back to 60 seconds when retry-after is non-numeric', () => {
    const result = mapProviderError(httpError(429, { 'retry-after': 'abc' }), 'groq', 'llama-3.3')
    expect((result as RateLimitedError).retryAfter).toBe(60)
  })

  it('clamps oversized retry-after values to 300 seconds', () => {
    const result = mapProviderError(httpError(429, { 'retry-after': '999999999999' }), 'groq', 'llama-3.3')
    expect((result as RateLimitedError).retryAfter).toBe(300)
  })

  it('truncates fractional retry-after values', () => {
    const result = mapProviderError(httpError(429, { 'retry-after': '15.5' }), 'groq', 'llama-3.3')
    expect((result as RateLimitedError).retryAfter).toBe(15)
  })

  it('maps abort and timeout-message errors to TimeoutError', () => {
    const abort = new Error('aborted')
    abort.name = 'AbortError'
    expect(mapProviderError(abort, 'openai', 'gpt-5.4')).toBeInstanceOf(TimeoutError)
    expect(mapProviderError(new Error('request timed out'), 'openai', 'gpt-5.4')).toBeInstanceOf(TimeoutError)
    expect(mapProviderError(new Error('request timeout'), 'openai', 'gpt-5.4')).toBeInstanceOf(TimeoutError)
  })

  it('returns the original error for non-http failures', () => {
    const original = new Error('boom')
    expect(mapProviderError(original, 'openai', 'gpt-5.4')).toBe(original)
  })

  it('wraps non-Error input in a plain Error', () => {
    const result = mapProviderError('boom', 'openai', 'gpt-5.4')
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('boom')
  })
})
