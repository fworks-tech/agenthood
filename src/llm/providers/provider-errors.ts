import {
  AuthError,
  RateLimitedError,
  TimeoutError,
  ServiceUnavailableError,
  ModelNotFoundError,
} from "../errors.ts"

const MAX_RETRY_AFTER = 300;
const TIMEOUT_ERROR_NAMES = new Set([
  "TimeoutError",
  "AbortError",
  "ETIMEDOUT",
  "ESOCKETTIMEDOUT",
  "EAI_AGAIN",
]);

function hasTimeoutName(err: Error): boolean {
  return TIMEOUT_ERROR_NAMES.has(err.name);
}

function hasTimeoutCause(err: Error): boolean {
  let cause: unknown = (err as Error & { cause?: unknown }).cause;
  while (cause instanceof Error) {
    if (TIMEOUT_ERROR_NAMES.has(cause.name)) return true;
    cause = (cause as Error & { cause?: unknown }).cause;
  }
  return false;
}

function isTimeoutError(err: Error): boolean {
  if (hasTimeoutName(err) || hasTimeoutCause(err)) return true;
  return err.message?.includes("timeout") || err.message?.includes("timed out") || false;
}

export function mapProviderError(
  err: unknown,
  providerName: string,
  model: string,
): Error {
  const httpErr = err as Error & { status?: number; headers?: Record<string, string | undefined> }
  if (err instanceof Error && typeof httpErr.status === "number") {
    const status = httpErr.status;
    if (status === 401) return new AuthError(providerName);
    if (status === 429) {
      const parsedRetryAfter = parseInt(String(httpErr.headers?.["retry-after"] ?? "60"), 10);
      const retryAfter = Number.isNaN(parsedRetryAfter) ? 60 : Math.min(parsedRetryAfter, MAX_RETRY_AFTER);
      return new RateLimitedError(providerName, retryAfter);
    }
    if (status === 408 || status === 504) return new TimeoutError(providerName);
    if (status === 404) return new ModelNotFoundError(providerName, model);
    if (status >= 500) return new ServiceUnavailableError(providerName);
  }
  if (err instanceof Error && isTimeoutError(err)) {
    return new TimeoutError(providerName);
  }
  return err instanceof Error ? err : new Error(String(err))
}
