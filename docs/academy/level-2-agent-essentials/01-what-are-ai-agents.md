# What Are AI Agents

> *An LLM answers questions. An agent solves problems. The difference is a loop, a memory, and a set of tools.*

---

## What it is

<!-- TODO: Issue #122 — Level 2 article content -->

_This article is coming in v1.6.0. See [issue #122](https://github.com/fworks-tech/agenthood/issues/122)._

**Covers:** The definition of an AI agent — plan, reason, act — and how Agenthood's `BaseAgent` and `ReActLoop` implement the core agent loop that every member in the Society uses.

---

## Why it matters in production

<!-- TODO: Issue #122 -->

---

## How Agenthood implements it

<!-- TODO: Issue #122 -->

**Maps to:** `src/agents/base/BaseAgent.ts`, `src/reasoning/ReActLoop.ts` _(coming in v2.0.0)_

---

## Hands-on example

<!-- TODO: Issue #122 -->

---

## Further reading

- [ADR-004 — Specialized members over general agent](../../docs/adr/ADR-004-specialized-members-over-general-agent.md)
- `src/agents/base/BaseAgent.ts` — the base agent class _(v2.0.0)_
- [ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629) — the foundational ReAct paper

---

## LinkedIn version

**Hook:** "AI agent" is not a marketing term. It is a specific architecture: observe, reason, act, repeat.

**Why it matters:**
- Without the observe-reason-act loop, you have a chatbot, not an agent
- Without memory, each iteration starts from zero — no learning, no context
- Agenthood's `BaseAgent` and `ReActLoop` give you the loop; you give it a role

**→** [Read the full article →](https://fworks-tech.github.io/agenthood/academy/level-2-agent-essentials/01-what-are-ai-agents/)
