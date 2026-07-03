import {
  AuthError,
  RateLimitedError,
  TimeoutError,
  ServiceUnavailableError,
  ModelNotFoundError,
} from "../errors.ts"

export function mapProviderError(
  err: unknown,
  providerName: string,
  model: string,
): Error {
  if (err instanceof Error && typeof (err as any).status === "number") {
    const status = (err as any).status;
    if (status === 401) return new AuthError(providerName);
    if (status === 429) {
      const retryAfter = parseInt(String((err as any).headers?.["retry-after"] ?? "60"), 10);
      return new RateLimitedError(providerName, retryAfter);
    }
    if (status === 408 || status === 504) return new TimeoutError(providerName);
    if (status === 404) return new ModelNotFoundError(providerName, model);
    if (status >= 500) return new ServiceUnavailableError(providerName);
  }
  if (err instanceof Error && (err.name === "AbortError" || err.message?.includes("timeout") || err.message?.includes("timed out"))) {
    return new TimeoutError(providerName);
  }
  return err instanceof Error ? err : new Error(String(err))
}
