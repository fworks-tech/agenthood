# ADR-042: Provider Routing for Member Runs

**Date:** 2026-11-16
**Status:** Accepted

## Context

A run has to pick one provider out of several, each with a different price, context window and
strength. Three inputs compete: the member's preferred provider (a Scribe drafting prose wants a
capable model; a Warden scanning files does not), the request's complexity (a one-line classification
does not need the frontier model), and the user's configuration (a free Groq key should be usable
without editing code).

The failure to avoid is a routing decision the user cannot see or override: a run that silently lands
on a different model than configured is a reproducibility problem, not a cost optimisation.

## Decision

**Static routing is the default and the only path a user has to opt out of.** With
`routing.strategy` absent or `static`, the configured provider — or the member's preferred provider
when none is configured — runs every step. Nothing changes under the user's feet.

**Dynamic routing is opt-in** (`routing.strategy: "dynamic"`), and scores each request into a tier:

| Tier | Rule | Route |
|------|------|-------|
| `high` | more than 3 tools, or a system prompt with chain-of-thought markers | configured provider, else Anthropic |
| `medium` | more than 5 messages, or any tools | configured provider, else Groq |
| `low` | everything else | Groq |

**Non-text requests bypass the tier table.** A request carrying an image, audio or video part goes to
`LLMRouter.multimodal()`, which requires a provider implementing `IMultimodalProvider` (#124). A
text-only provider answers with the missing capability instead of pretending to see the image.

**Failover is a separate layer (ADR-027).** Routing chooses the first provider; `ProviderChain` owns
the circuit breaker, retries and fallback list. Routing never silently substitutes a provider outside
the failover chain the user configured.

**Every outbound request is redacted before it leaves** (`withRequestRedaction`), including multimodal
text parts. That guard is unconditional and is not a routing decision.

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|--------------|
| Dynamic by default | cheaper runs | a run's model changes with message count; results are not reproducible | Rejected |
| Per-member hard-coded model | predictable | ignores the user's keys, and a member cannot be used with a different provider | Rejected |
| Route by price table only | cheapest | cheapest is not capable enough for review or architecture work | Rejected: tiers carry the intent |
| No failover in routing | simpler | one rate limit kills the run | Rejected: ADR-027 exists |

## Consequences

- The default is boring on purpose: same provider, same model, until the user asks for tiers.
- A dynamic run is explainable: the tier comes from message count, tool count and prompt markers, all
  of which are visible in the request.
- Adding a provider means implementing `ILLMProvider` (and `IMultimodalProvider` for modalities) and
  registering it; the routing table does not change.
- Cost estimates come from the static pricing table (`src/core/modelPricing.ts`); an unknown model
  falls back with a warning rather than guessing a price.

## References

- `src/llm/LLMRouter.ts` (`route`, `ComplexityScorer`, `multimodal`), `src/llm/IMultimodalProvider.ts`
- [ADR-027](ADR-027-provider-failover.md) — chain, circuit breaker, per-request timeout
- [ADR-035](ADR-035-skill-namespaces-and-well-known-catalogs.md) — endpoint-keyed catalog caching
- `docs/architecture/provider-failover.md`, `docs/guides/adding-a-provider.md`
