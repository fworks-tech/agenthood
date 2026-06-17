# Deploy to Production

> *An agent that works on your machine is a prototype. An agent that works for your users is a product.*

---

## What it is

<!-- TODO: Issue #123 — Level 3 article content -->

_This article is coming in v1.6.0. See [issue #123](https://github.com/fworks-tech/agenthood/issues/123)._

**Covers:** Shipping agents for real users — the v3.0.0 API layer, auth middleware, rate limiting, and the operational runbooks that keep production agents alive after deployment day.

---

## Why it matters in production

<!-- TODO: Issue #123 -->

---

## How Agenthood implements it

<!-- TODO: Issue #123 -->

**Maps to:** v3.0.0 API layer — Express API, auth, rate limiting _(coming in v3.0.0)_

Links to the [v3.0.0 milestone](https://github.com/fworks-tech/agenthood/milestone/3) for implementation status.

---

## Hands-on example

<!-- TODO: Issue #123 -->

---

## Further reading

- v3.0.0 milestone: API & Multi-tenancy _(coming in v3.0.0)_
- [The Twelve-Factor App](https://12factor.net/) — production deployment principles that apply to agents too
- [LLM-based application deployment best practices](https://www.anyscale.com/blog/llm-deployment) — practical production notes

---

## LinkedIn version

**Hook:** Most agent demos never become products. The gap is not capability — it is auth, rate limits, and the runbook you did not write.

**Why it matters:**
- Multi-tenant agents need per-user context isolation — shared memory is a security boundary
- Rate limiting protects your LLM budget and your users from runaway loops
- Agenthood's v3.0.0 API layer is the production scaffold you do not have to build yourself

**→** [Read the full article →](https://agenthood.flabs.tech/academy/level-3-advanced-skills/05-deploy-to-production/)
