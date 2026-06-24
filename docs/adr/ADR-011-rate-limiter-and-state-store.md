# ADR-011: Rate Limiter and State Store

**Date:** 2026-06-24
**Status:** Accepted

## Context

Agenthood needs rate limiting to protect against provider API rate limits and to prevent runaway agent loops from overwhelming external services. The ProviderFailover module (`src/llm/ProviderFailover.ts`) already classifies 429 (rate limited) errors and applies circuit breaker cooldowns, but the current implementation is ad-hoc:

- Cooldowns are in-memory only — lost on restart
- No per-tool or per-agent rate limiting — only per-provider circuit breaker states
- No distinction between provider-side rate limits and agent-side rate limit enforcement
- Retry-After header parsing is not implemented (uses hardcoded 60s default for 429s)

Academy articles reference ADR-011 as a stub, and the v2.0.0 Foundation Audit identified this gap.

## Decision

Rate limiting is handled at two layers, with a clear separation of concerns:

### Layer 1: Provider-level circuit breaker (current, in ProviderFailover)

The existing per-provider circuit breaker (`src/llm/ProviderFailover.ts`) remains the first line of defense. It:

- Classifies provider errors including 429 (rate_limited)
- Trips a circuit breaker with configurable cooldown
- Probes for recovery before cooldown expiry
- Uses hardcoded defaults (60s for 429) until Retry-After header parsing is added

This layer is in-memory only. Circuit state persistence across restarts is deferred (see Open Questions).

### Layer 2: Agent-level rate limiter

A new `RateLimiter` class in `src/core/RateLimiter.ts` enforces outbound rate limits:

- **Algorithm:** Sliding window log — tracks request timestamps per provider, rejects if window exceeds threshold
- **Window:** 60 seconds (configurable per provider)
- **Threshold:** Default 30 requests per minute (configurable via `LLMConfig.failover`)
- **Scope:** Per-provider, not per-tool or per-agent — a single agent using one provider shares the same window
- **State:** In-memory only (matches circuit breaker pattern; persistence deferred)
- **Relationship to circuit breaker:** RateLimiter prevents 429s (proactive), circuit breaker handles them when they happen (reactive)

### State store

Both layers use in-memory state. The circuit breaker states and rate limiter windows are stored in `Map<string, CircuitBreakerState>` and `Map<string, number[]>` respectively, inside the relevant class instances.

**Why not Redis or LanceDB?**
- No external infrastructure (consistent with ADR-008 zero-infrastructure goal)
- Circuit breaker state is ephemeral by nature — a restart resets it, which is acceptable
- Rate limiter windows are high-frequency, high-churn data — not suitable for persistent storage
- LanceDB (ADR-010) is optimized for vector storage, not for high-throughput counter data

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|-------------|
| Sliding window log (chosen) | Precise; no clock skew issues; easy to reason about | O(window) memory per provider | Acceptable — max ~60 timestamps per provider per minute |
| Token bucket | Constant memory per provider; burst-friendly | Harder to tune bucket size/refill rate; clock-dependent | Simplicity favors sliding window for v2 |
| Fixed window counter | Minimal memory; simple implement | Thundering herd at window boundary (all requests reset at once) | Burst behavior at boundary is undesirable |
| Leaky bucket | Smooth egress; predictable | Underutilizes capacity during low traffic | Overly conservative for agent workloads |
| Redis-backed | Shared state across processes; persistent | External dependency; operations burden | Violates ADR-008 zero-infrastructure constraint |

## Consequences

**Easier:**
- Rate limiting and circuit breaking work together: limiter prevents, breaker recovers
- No infrastructure dependencies — all state is in-memory
- Sliding window is simple to implement and test
- Configurable thresholds allow operators to tune per-provider

**Harder:**
- Restart resets all circuit breaker and rate limiter state (acceptable for v2)
- No cross-process rate limiting (not a concern for single-process CLI runtime)
- Provider-side Retry-After headers are not yet parsed (hardcoded defaults used instead)

**Deferred:**
- Circuit breaker state persistence (beyond session)
- Retry-After header parsing from provider responses
- Per-tool or per-agent rate limit scopes (only per-provider)

## References

- [ProviderFailover.ts](../../src/llm/ProviderFailover.ts) — circuit breaker implementation
- [ADR-008](ADR-008-typescript-runtime-over-python.md) — TypeScript runtime constraint
- [ADR-009](ADR-009-groq-as-default-llm-provider.md) — default LLM provider
- [ADR-010](ADR-010-lancedb-for-vector-storage.md) — vector store (contrast with rate limiter state store)
- [Academy: Action Planning](../../docs/academy/level-2-agent-essentials/10-action-planning.md) — original ADR-011 stub reference
