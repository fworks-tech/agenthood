/** CLOSED = normal, OPEN = cooldown, HALF_OPEN = probe in flight */
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

/** Per‑provider circuit breaker state, stored in‑memory. */
export interface CircuitBreakerState {
  state: CircuitState
  failureCount: number
  cooldownUntil: number
  probeScheduledAt: number
}

/**
 * Structured error classification returned by classifyError().
 * Every provider error maps to one of 7 categories with explicit
 * retryability and cooldown semantics.
 */
export interface ClassifiedError {
  category: 'auth' | 'payment' | 'rate_limited' | 'timeout' | 'unavailable' | 'model_not_found' | 'unknown'
  retryable: boolean
  retryAfter: number
  cooldownMs: number
  permanent: boolean
}

/** Configurable limits for provider-level retry behaviour within a chain. */
export interface ProviderChainConfig {
  maxRetries?: number
  backoffBaseMs?: number
  failureThreshold?: number
  cooldownMs?: number
  probeEnabled?: boolean
}
