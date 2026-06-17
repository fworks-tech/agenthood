# Agentic Frameworks

> *LangChain wraps the LLM. Agenthood wraps the engineer. The distinction matters.*

---

## What it is

<!-- TODO: Issue #122 — Level 2 article content -->

_This article is coming in v1.6.0. See [issue #122](https://github.com/fworks-tech/agenthood/issues/122)._

**Covers:** Why Agenthood builds its own TypeScript runtime instead of wrapping LangChain, CrewAI, or LangGraph — the architectural reasoning behind ADR-008 and what it means for your agents.

---

## Why it matters in production

<!-- TODO: Issue #122 -->

---

## How Agenthood implements it

<!-- TODO: Issue #122 -->

**Maps to:** ADR-008 — TypeScript-native runtime over Python + DeepAgents _(v2.0.0)_

---

## Hands-on example

<!-- TODO: Issue #122 -->

---

## Further reading

- ADR-008 — TypeScript-native runtime _(coming in v2.0.0)_
- ADR-007 — DeepAgents superseded _(see `docs/adr/ADR-007-deepagents-as-execution-engine.md`)_
- [LangChain vs custom agents](https://python.langchain.com/docs/concepts/) — what LangChain covers well and where it adds overhead

---

## LinkedIn version

**Hook:** Every "ship fast" framework eventually makes you ship slow. Agenthood is designed so the framework never becomes the bottleneck.

**Why it matters:**
- Wrappers add abstraction layers you did not choose and cannot remove
- TypeScript-native means the type system catches agent contract violations at compile time
- Agenthood builds the runtime it needs — no upstream dependency waiting to break you

**→** [Read the full article →](https://agenthood.flabs.tech/academy/level-2-agent-essentials/02-agentic-frameworks/)
