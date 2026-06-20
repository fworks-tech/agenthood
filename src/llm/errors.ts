/**
 * src/llm/errors.ts
 *
 * Error hierarchy for LLM provider operations. Each error corresponds to
 * a failure classification from architecture/provider-failover.md.
 */

export class UnsupportedOperationError extends Error {
  constructor(operation: string, provider: string) {
    super(`${provider} does not support "${operation}"`)
    this.name = 'UnsupportedOperationError'
  }
}

export class AuthError extends Error {
  constructor(provider: string, detail?: string) {
    super(`Authentication failed for ${provider}${detail ? `: ${detail}` : ''}`)
    this.name = 'AuthError'
  }
}

export class PaymentRequiredError extends Error {
  constructor(provider: string) {
    super(`Payment required for ${provider}`)
    this.name = 'PaymentRequiredError'
  }
}

export class RateLimitedError extends Error {
  readonly retryAfter: number

  constructor(provider: string, retryAfter: number = 60) {
    super(`Rate limited by ${provider}, retry after ${retryAfter}s`)
    this.name = 'RateLimitedError'
    this.retryAfter = retryAfter
  }
}

export class TimeoutError extends Error {
  constructor(provider: string) {
    super(`Request to ${provider} timed out`)
    this.name = 'TimeoutError'
  }
}

export class ServiceUnavailableError extends Error {
  constructor(provider: string) {
    super(`${provider} is unavailable`)
    this.name = 'ServiceUnavailableError'
  }
}

export class ModelNotFoundError extends Error {
  constructor(provider: string, model: string) {
    super(`Model "${model}" not found on ${provider}`)
    this.name = 'ModelNotFoundError'
  }
}
