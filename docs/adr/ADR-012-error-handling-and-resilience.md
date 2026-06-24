# ADR-012: Error Handling and Resilience Strategy

**Date:** 2026-06-24
**Status:** Accepted

## Context

The ProviderFailover module (`src/llm/ProviderFailover.ts`) implements a multi-layered resilience strategy, but the design decisions were never formally documented. The v2.0.0 Foundation Audit identified that ADR-011 and ADR-012 were stubs referenced in academy articles but never created. This ADR captures the error handling taxonomy, circuit breaker state machine, retry strategies, and the relationships between resilience components.

The strategy spans three layers:
1. **Rate limiter** (proactive — prevents errors before they happen)
2. **Circuit breaker** (reactive — handles errors when they occur)
3. **Provider chain** (orchestration — rotates through providers)

## Decision

### Failure classification taxonomy

All provider errors are classified into one of 7 categories by `classifyError()` in `ProviderFailover.ts`:

| Category | HTTP Codes | Retryable | Permanent | Default Cooldown | Behavior |
|----------|-----------|-----------|-----------|-----------------|----------|
| `auth` | 401 | No | Yes | 0ms | Skip provider permanently, throw immediately |
| `payment` | 402 | No | Yes | 0ms | Skip provider permanently |
| `rate_limited` | 429 | Yes | No | `Retry-After` header × 1000 (default 60s) | Trip breaker, probe before cooldown expiry |
| `timeout` | 408 | Yes | No | 30s | Trip breaker, retry with backoff |
| `unavailable` | 503, 500+ | Yes | No | 60s | Trip breaker, probe before cooldown expiry |
| `model_not_found` | 404 | No | Yes | 0ms | Skip provider permanently |
| `unknown` | Other | No | No | 0ms | Propagate to caller — no circuit state change |

Classification cascades: instanceof checks first (via typed error classes), then regex match for embedded HTTP status codes in error messages, then falls through to `unknown`.

### Circuit breaker state machine

Three states, stored per-provider in `Map<string, CircuitBreakerState>`:

```
                  ┌──────────────────────────────────────┐
                  │                                      │
                  ▼                                      │
    ┌─────────┐       permanent error       ┌────────┐  │
    │  CLOSED │ ──────────────────────────▶  │  OPEN  │  │
    │         │         (cooldown=inf)       │        │──┘
    │ (normal)│                              │ (open) │
    │         │◀──── probe succeeds ────────│        │
    └─────────┘     (onSuccess())            └────────┘
         │                                      │
         │ retryable error          cooldown    │
         │ (tripBreaker())          expires     │
         │                                      │
         ▼                                      ▼
    ┌─────────┐                              ┌──────────┐
    │         │                              │ HALF_OPEN │
    │         │◀───── probe scheduled ──────│          │
    │         │      (cooldown - 30s)        │  (probing)│
    └─────────┘                              └──────────┘
                                                   │
                                          probe     │
                                          fails     │
                                                   ▼
                                               ┌────────┐
                                               │  OPEN  │
                                               └────────┘
```

**Transitions:**
- **CLOSED → OPEN:** `tripBreaker()` called on any classified error. Sets `cooldownUntil` timestamp.
- **OPEN → HALF_OPEN:** `activeProviders()` runs before each request. If `Date.now() >= probeScheduledAt`, transitions to probing state.
- **HALF_OPEN → CLOSED:** `onSuccess()` resets failure count and cooldown. The probe request succeeded.
- **HALF_OPEN → OPEN:** If probe request fails, `tripBreaker()` is called again, resetting cooldown.

### Retry/backoff strategies (5 strategies)

Defined in `executeWithStrategy()` and the provider loop in `complete()`:

1. **Immediate retry** — Retry the same provider once immediately for transient errors
2. **Exponential backoff** — Sleep `1000 × 2^index` ms then retry (index = retry attempt number)
3. **Provider rotation** — If all strategies on provider A fail, move to provider B in the chain
4. **Model downgrade** — NOT YET IMPLEMENTED. When primary model fails on a provider, retry with cheaper/faster model on the same provider (tracked in #217)
5. **Human escalation** — NOT YET IMPLEMENTED. When all providers and models fail, surface the error chain to the user

### Probe recovery

Probe requests are sent 30 seconds before cooldown expiry (`probeScheduledAt = cooldownUntil - 30_000`). This preemptive approach:

- Reduces user-visible latency (no need to wait for full cooldown)
- Works for cooldowns > 30s (rate_limited: 60s, unavailable: 60s, timeout: 30s — timeout is borderline)
- Uses `activeProviders()` filter, called at the start of every `complete()` and `stream()` invocation
- No separate probe request — the next user request to that provider serves as the probe

### Error propagation across the provider chain

```
Provider A (preferred)
  ├── Strategy 1: immediate retry
  ├── Strategy 2: exponential backoff
  ├── Strategy 3: provider rotation (to B)
  └── Strategy 4: model downgrade (on A, not yet implemented)

Provider B (fallback 1)  ← same strategy set repeats
Provider C (fallback 2)  ← same strategy set repeats

All failed → AllProvidersFailedError with concatenated error messages
```

`AllProvidersFailedError` carries a `category` field reflecting the most recent failure category, enabling callers to make informed decisions about what to report to the user.

### Relationship to RiskManager and SafetyGuard

| Component | Concern | Interaction with ProviderFailover |
|-----------|---------|----------------------------------|
| **ProviderFailover** | Provider reliability | Circuit breaker, failover, retry |
| **RiskManager** | Tool-level safety (paths, hosts, file size) | Separate — validates inputs before any provider call |
| **SafetyGuard** | Agent loop safety (caps, profiles, loop detection) | Separate — monitors agent behavior, not provider calls |
| **RateLimiter** | Request throttling (proposed in ADR-011) | Prevents 429s; circuit breaker handles them when they occur |

## Alternatives Considered

| Strategy | Pros | Cons | Why Rejected |
|----------|------|------|-------------|
| Exponential backoff only (no circuit breaker) | Simpler implementation | No cooldown — hammering provider on every retry | Without circuit breaker, transient errors cause sustained load |
| Circuit breaker without probe recovery | Simpler state machine | Must wait full cooldown before retrying — poor UX | Preemptive probes reduce visible latency |
| All errors are permanent | Simple, predictable | Poor resilience — any transient failure kills the agent | Unacceptable for production use |
| Single provider, no failover | Simplest possible | Single point of failure | Incompatible with M4 requirements |

## Consequences

**Easier:**
- Clear taxonomy for classifying any provider error
- State machine is simple enough to reason about and test
- Probe recovery reduces user-visible latency
- Provider chain is extensible (add a provider → more resilience)

**Harder:**
- 5 strategies are split across two code paths (executeWithStrategy + provider loop) — non-obvious
- No configurable failure threshold (always trips on first error)
- No Retry-After header parsing (hardcoded defaults)
- Probe recovery at `cooldown - 30s` is a heuristic — may not match all provider rate limit windows

**Deferred to #217:**
- Strategy 4 (model downgrade per-provider)
- Strategy 5 (human escalation)
- Configurable circuit breaker thresholds (`failureThreshold`, `failureWindow`)

## References

- [ProviderFailover.ts](../../src/llm/ProviderFailover.ts) — implementation
- [docs/specs/provider-failover.md](../../docs/specs/provider-failover.md) — full spec with acceptance criteria
- [ADR-008](ADR-008-typescript-runtime-over-python.md) — TypeScript runtime
- [ADR-009](ADR-009-groq-as-default-llm-provider.md) — default LLM provider
- [ADR-011](ADR-011-rate-limiter-and-state-store.md) — rate limiting (companion resilience layer)
- [Academy: Agent Workflows](../../docs/academy/level-2-agent-essentials/04-agent-workflows.md) — original ADR-012 stub reference
