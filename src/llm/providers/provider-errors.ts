import {
  AuthError,
  RateLimitedError,
  TimeoutError,
  ServiceUnavailableError,
  ModelNotFoundError,
} from "../errors.ts"

const MAX_RETRY_AFTER = 300

const TIMEOUT_ERROR_NAMES = new Set([
  "TimeoutError",
  "AbortError",
  "OperationTimeoutError",
])

const TIMEOUT_ERROR_CODES = new Set([
  "ETIMEDOUT",
  "ESOCKETTIMEDOUT",
  "EAI_AGAIN",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
  "UND_ERR_ABORTED",
])

function isTimeoutLike(err: Error): boolean {
  if (TIMEOUT_ERROR_NAMES.has(err.name)) return true
  const code = (err as Error & { code?: string }).code
  if (code && TIMEOUT_ERROR_CODES.has(code)) return true
  return false
}

function isTimeoutError(err: Error): boolean {
  if (isTimeoutLike(err)) return true
  let cause: unknown = (err as Error & { cause?: unknown }).cause
  let depth = 0
  while (cause instanceof Error && depth++ < 5) {
    if (isTimeoutLike(cause)) return true
    cause = (cause as Error & { cause?: unknown }).cause
  }
  return false
}

export function mapProviderError(
  err: unknown,
  providerName: string,
  model: string,
): Error {
  const httpErr = err as Error & { status?: number; headers?: Record<string, string | undefined> }
  if (err instanceof Error && typeof httpErr.status === "number") {
    const status = httpErr.status
    if (status === 401) return new AuthError(providerName)
    if (status === 429) {
      const parsedRetryAfter = parseInt(String(httpErr.headers?.["retry-after"] ?? "60"), 10)
      const retryAfter = Number.isNaN(parsedRetryAfter) ? 60 : Math.min(parsedRetryAfter, MAX_RETRY_AFTER)
      return new RateLimitedError(providerName, retryAfter)
    }
    if (status === 408 || status === 504) return new TimeoutError(providerName)
    if (status === 404) return new ModelNotFoundError(providerName, model)
    if (status >= 500) return new ServiceUnavailableError(providerName)
  }
  if (err instanceof Error && isTimeoutError(err)) {
    return new TimeoutError(providerName)
  }
  return err instanceof Error ? err : new Error(String(err))
}
