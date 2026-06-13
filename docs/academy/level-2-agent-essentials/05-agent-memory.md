# Agent Memory

> *An agent with no memory repeats its mistakes. An agent with no memory governance accumulates them.*

---

## What it is

<!-- TODO: Issue #122 — Level 2 article content -->

_This article is coming in v1.6.0. See [issue #122](https://github.com/fworks-tech/agenthood/issues/122)._

**Covers:** Agenthood's five-tier memory model — Short-Term (working context), Long-Term (persistent facts), Episodic (past executions), Project (codebase knowledge), Residual (implicit trace signals) — and when to use each.

---

## Why it matters in production

<!-- TODO: Issue #122 -->

---

## How Agenthood implements it

<!-- TODO: Issue #122 -->

**Maps to:** `src/memory/` — all five memory types _(coming in v2.1.0)_

---

## Hands-on example

<!-- TODO: Issue #122 -->

---

## Further reading

- [ADR-010 — LanceDB for vector storage](../../docs/adr/) _(coming in v2.0.0)_
- `src/memory/IMemoryStore.ts` — memory store interface _(v2.1.0)_
- [The Cognitive Architecture for Language Agents (CoALA)](https://arxiv.org/abs/2309.02427) — memory taxonomy paper

---

## LinkedIn version

**Hook:** Every agent is only as good as what it remembers. Most agents remember nothing past the context window.

**Why it matters:**
- Short-term memory fills up; without compression, agents start hallucinating from overflow
- Long-term memory without governance becomes stale data poisoning fresh queries
- Agenthood's five-tier model gives each memory type its own lifecycle and retrieval path

**→** [Read the full article →](https://fworks-tech.github.io/agenthood/academy/level-2-agent-essentials/05-agent-memory/)
