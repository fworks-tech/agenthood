# ADR-027: Provider Chain with Circuit Breaker and Per-Request Timeout

**Date:** 2026-09-21
**Status:** Accepted

## Context

`agenthood run` must work across free and paid providers (Groq default per ADR-009,
OpenAI, Anthropic, OpenRouter, Ollama local, opencode). Any one provider can rate-limit,
hang, or die mid-session. A run is interactive — the adopter is watching — so failover
must be fast, visible, and bounded.

## Decision

`src/llm/ProviderFailover.ts` (`ProviderChain`) implements `ILLMProvider` over an
ordered provider list:

- Per-provider circuit breaker (failure threshold → OPEN → cooldown → HALF_OPEN probe),
  configured via `.agenthood/config.json` `failover` block.
- Two cheap retries with short capped backoff, then remaining-model fallback per provider,
  then failover to the next provider in the chain — total budget stays under CI time limits.
- Per-request timeout `requestTimeoutMs` (default 60s, floored at 1s) races every
  `complete()` and rejects with `TimeoutError`; `stream()`/`embed()` are intentionally
  outside the cap (long-lived / local-cheap).
- Hard-stop classes (auth, payment) skip failover — retrying another provider with the
  same credentials is noise.
- `agenthood health` probes providers with a real minimal completion and reports
  round-trip latency; `AGENTHOOD_HEALTH_SKIP_PROBES=1` keeps offline checks possible.

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|-------------|
| Single provider + retry loop | simplest | free-tier limits make runs flaky; no offline escape | Rejected |
| External gateway (OpenRouter-only) | one API | adds a paid third-party dependency and network hop for everyone | Rejected |
| Per-call AbortController plumbing | cancels hung sockets | providers' SDKs expose no uniform signal path today | Deferred (marked TODO) |

## Consequences

Easier: resilience policy is configuration, not code; health truth matches run behavior.
Harder: latency of a dead provider is still paid once per window (bounded by the timeout);
breaker state is process-local — long-lived hosts share nothing across processes.

## References

- `src/llm/ProviderFailover.ts`, `src/llm/LLMRouter.ts`, `src/commands/health.ts`
- ADR-009; issues #649/#659, PRs #903/#905; `docs/architecture/provider-failover.md`
