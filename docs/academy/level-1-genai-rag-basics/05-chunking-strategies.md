# Chunking Strategies

> *Poor chunking quietly destroys retrieval quality. The Society does not tolerate quiet destruction.*

---

## What it is

<!-- TODO: Issue #121 — Level 1 article content -->

_This article is coming in v1.6.0. See [issue #121](https://github.com/fworks-tech/agenthood/issues/121)._

**Covers:** Why document chunking matters for RAG, the tradeoffs between chunk size and retrieval precision, and how Agenthood's `HierarchicalChunkStrategy` solves the context-precision tension.

---

## Why it matters in production

<!-- TODO: Issue #121 -->

---

## How Agenthood implements it

<!-- TODO: Issue #121 -->

**Maps to:** `src/rag/ChunkStrategy.ts`, `src/rag/HierarchicalChunkStrategy.ts` _(coming in v2.1.0)_

---

## Hands-on example

<!-- TODO: Issue #121 -->

---

## Further reading

- `src/rag/ChunkStrategy.ts` — base chunking interface
- [Chunking strategies for LLM applications](https://www.pinecone.io/learn/chunking-strategies/) — Pinecone

---

## LinkedIn version

**Hook:** Poor chunking quietly destroys retrieval quality. Most RAG failures are chunking failures wearing the wrong costume.

**Why it matters:**
- Chunks too small: accurate matches, missing context — the LLM answers half the question
- Chunks too large: diluted embeddings — wrong results retrieved confidently
- Hierarchical chunking embeds small, returns large — precision without context loss

**→** [Read the full article →](https://fworks-tech.github.io/agenthood/academy/level-1-genai-rag-basics/05-chunking-strategies/)
