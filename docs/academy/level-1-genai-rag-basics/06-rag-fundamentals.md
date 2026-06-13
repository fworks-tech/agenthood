# RAG Fundamentals

> *An LLM without retrieval knows only what it was trained on. Training ended months ago. Your data did not.*

---

## What it is

<!-- TODO: Issue #121 — Level 1 article content -->

_This article is coming in v1.6.0. See [issue #121](https://github.com/fworks-tech/agenthood/issues/121)._

**Covers:** The Retrieval-Augmented Generation pipeline — Retriever, Indexer, Embedder — and how Agenthood wires them into agents so your LLM answers with your data, not just its training data.

---

## Why it matters in production

<!-- TODO: Issue #121 -->

---

## How Agenthood implements it

<!-- TODO: Issue #121 -->

**Maps to:** `src/rag/Retriever.ts`, `src/rag/Indexer.ts`, `src/rag/Embedder.ts` _(coming in v2.1.0)_

---

## Hands-on example

<!-- TODO: Issue #121 -->

---

## Further reading

- [ADR-010 — LanceDB for vector storage](../../docs/adr/) _(coming in v2.0.0)_
- `src/rag/Retriever.ts` — retrieval interface _(v2.1.0)_
- [Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks](https://arxiv.org/abs/2005.11401) — original RAG paper

---

## LinkedIn version

**Hook:** Your LLM's training data is frozen in time. RAG unfreezes it.

**Why it matters:**
- Without retrieval, agents answer questions about your codebase with guesses
- Naive retrieval (keyword search) misses semantic relationships — vector search does not
- Agenthood's RAG pipeline connects the retriever, indexer, and embedder so you configure once

**→** [Read the full article →](https://fworks-tech.github.io/agenthood/academy/level-1-genai-rag-basics/06-rag-fundamentals/)
