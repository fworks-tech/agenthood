import type { ClassifiedError } from './providerFailoverTypes.ts'
import {
  AuthError,
  PaymentRequiredError,
  RateLimitedError,
  TimeoutError,
  ServiceUnavailableError,
  ModelNotFoundError,
} from './errors.ts'

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

/** HTTP status → fixed classification. 400 is permanent: retrying a malformed
 * request cannot succeed, so the chain must fail over immediately instead of
 * burning backoff retries. 5xx is handled separately (retryable unavailable).
 * Frozen: shared across calls, consumers must not mutate them. */
const STATUS_CLASSIFICATIONS: Record<number, ClassifiedError> = Object.freeze({
  400: Object.freeze({ category: 'bad_request', retryable: false, retryAfter: 0, cooldownMs: 0, permanent: true }),
  401: Object.freeze({ category: 'auth', retryable: false, retryAfter: 0, cooldownMs: 0, permanent: true }),
  402: Object.freeze({ category: 'payment', retryable: false, retryAfter: 0, cooldownMs: 0, permanent: true }),
  408: Object.freeze({ category: 'timeout', retryable: true, retryAfter: 30, cooldownMs: 30_000, permanent: false }),
  429: Object.freeze({ category: 'rate_limited', retryable: true, retryAfter: 60, cooldownMs: 60_000, permanent: false }),
} as Record<number, ClassifiedError>)

const UNKNOWN: ClassifiedError = Object.freeze({ category: 'unknown', retryable: false, retryAfter: 0, cooldownMs: 0, permanent: false })

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
  const statusMatch = msg.match(/\b(40[0-2]|408|429|50[0-9])\b/)

  if (statusMatch) {
    const status = parseInt(statusMatch[1], 10)
    if (status >= 500) {
      return { category: 'unavailable', retryable: true, retryAfter: 60, cooldownMs: 60_000, permanent: false }
    }
    return STATUS_CLASSIFICATIONS[status] ?? UNKNOWN
  }

  return UNKNOWN
}
