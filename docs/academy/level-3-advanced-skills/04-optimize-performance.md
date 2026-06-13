# Optimize Performance

> *Fast, cheap, and reliable. Production agents need all three. Agenthood routes to all three.*

---

## What it is

<!-- TODO: Issue #123 — Level 3 article content -->

_This article is coming in v1.6.0. See [issue #123](https://github.com/fworks-tech/agenthood/issues/123)._

**Covers:** Speed, cost, and reliability — `CostEstimator` for per-request cost visibility, `LLMRouter` dynamic routing to match model capability to query complexity, and `ProviderFailover` to keep agents running when one provider goes down.

---

## Why it matters in production

<!-- TODO: Issue #123 -->

---

## How Agenthood implements it

<!-- TODO: Issue #123 -->

**Maps to:** `src/llm/LLMRouter.ts`, `src/llm/ProviderFailover.ts`, `src/evals/CostEstimator.ts` _(coming in v2.0.0 / v2.4.0)_

---

## Hands-on example

<!-- TODO: Issue #123 -->

---

## Further reading

- `src/llm/LLMRouter.ts` — dynamic routing _(v2.0.0)_
- `src/llm/ProviderFailover.ts` — failover chain _(v2.0.0)_
- [LLM pricing comparison](https://artificialanalysis.ai/) — live model cost benchmarks

---

## LinkedIn version

**Hook:** At scale, every unnecessary `gpt-4o` call is a line item. Routing simple queries to fast free models is not a compromise; it is engineering.

**Why it matters:**
- Dynamic routing cuts costs without degrading quality — simple queries do not need expensive models
- Provider failover means a provider outage becomes a blip, not an incident
- `CostEstimator` makes costs visible before they surprise you on the invoice

**→** [Read the full article →](https://fworks-tech.github.io/agenthood/academy/level-3-advanced-skills/04-optimize-performance/)
