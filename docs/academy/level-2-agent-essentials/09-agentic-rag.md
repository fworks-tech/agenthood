# Agentic RAG

> *Passive RAG always retrieves. Agentic RAG decides. The agent that decides is the one that ships.*

---

## What it is

<!-- TODO: Issue #122 — Level 2 article content -->

_This article is coming in v1.6.0. See [issue #122](https://github.com/fworks-tech/agenthood/issues/122)._

**Covers:** The difference between passive RAG (always retrieve before answering) and Agentic RAG (agent decides when, where, and what to retrieve) — and how `AgenticRAG` and `RetrievalDecisionSkill` implement the smarter approach.

---

## Why it matters in production

<!-- TODO: Issue #122 -->

---

## How Agenthood implements it

<!-- TODO: Issue #122 -->

**Maps to:** `src/rag/AgenticRAG.ts`, `src/skills/rag/RetrievalDecisionSkill.ts` _(coming in v2.1.0)_

---

## Hands-on example

<!-- TODO: Issue #122 -->

---

## Further reading

- `src/rag/AgenticRAG.ts` — agentic retrieval orchestration _(v2.1.0)_
- [Self-RAG: Learning to Retrieve, Generate, and Critique through Self-Reflection](https://arxiv.org/abs/2310.11511) — the foundational Agentic RAG paper

---

## LinkedIn version

**Hook:** Passive RAG retrieves whether it needs to or not. At 1000 queries a day, that is a lot of unnecessary tokens.

**Why it matters:**
- Always-retrieve adds latency and cost even when the answer is already in context
- Smart retrieval routing (vector vs graph vs skip) matches the tool to the question
- Agenthood's `AgenticRAG` attaches provenance to every answer — you know exactly what was used

**→** [Read the full article →](https://agenthood.flabs.tech/academy/level-2-agent-essentials/09-agentic-rag/)
