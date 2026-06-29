import type { ClassifiedError } from './providerFailoverTypes.ts'
import {
  AuthError,
  PaymentRequiredError,
  RateLimitedError,
  TimeoutError,
  ServiceUnavailableError,
  ModelNotFoundError,
} from './errors.js'

/**
 * Thrown when every provider in the chain has been exhausted.
 * Carries the category of the most recent failure so callers can
 * decide whether to escalate or provide a fallback experience.
 */
export class AllProvidersFailedError extends Error {
  readonly category: string

  constructor(errors: string[], category: string = 'unknown') {
    super(`All providers failed: ${errors.join('; ')}`)
    this.name = 'AllProvidersFailedError'
    this.category = category
  }
}

/**
 * Classify an error into a structured category with retry/cooldown semantics.
 * Checks typed error classes first (AuthError, RateLimitedError, etc.),
 * then falls back to HTTP status codes embedded in error messages,
 * then returns 'unknown' as the default.
 */
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
