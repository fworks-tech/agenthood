# Multi-Agent Systems

> *Peer-to-peer coordination looks elegant on a diagram. In production, it becomes a deadlock.*

---

## What it is

<!-- TODO: Issue #122 — Level 2 article content -->

_This article is coming in v1.6.0. See [issue #122](https://github.com/fworks-tech/agenthood/issues/122)._

**Covers:** Why the Society uses an orchestrator pattern (ADR-005) instead of peer-to-peer agent coordination — and how `WorkflowEngine` and `ParallelStep` implement it correctly.

---

## Why it matters in production

<!-- TODO: Issue #122 -->

---

## How Agenthood implements it

<!-- TODO: Issue #122 -->

**Maps to:** `src/workflows/WorkflowEngine.ts`, ADR-005 _(coming in v2.3.0)_

---

## Hands-on example

<!-- TODO: Issue #122 -->

---

## Further reading

- [ADR-005 — Orchestrator pattern over peer-to-peer](../../docs/adr/ADR-005-orchestrator-pattern.md)
- `src/workflows/WorkflowEngine.ts` — the orchestrator _(v2.3.0)_
- [AutoGen: Enabling Next-Gen LLM Applications via Multi-Agent Conversation](https://arxiv.org/abs/2308.08155) — multi-agent coordination paper

---

## LinkedIn version

**Hook:** Multi-agent peer-to-peer systems have a hidden property: every agent is also a point of failure for every other agent.

**Why it matters:**
- Without a central orchestrator, failure propagation is unpredictable
- Parallel execution without coordination produces race conditions in shared state
- Agenthood's orchestrator pattern (ADR-005) is the reason the Society's 14 members do not step on each other

**→** [Read the full article →](https://fworks-tech.github.io/agenthood/academy/level-2-agent-essentials/08-multi-agent-systems/)
