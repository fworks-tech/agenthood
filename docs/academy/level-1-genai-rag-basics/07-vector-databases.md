# Vector Databases

> *Keyword search finds what you said. Semantic search finds what you meant. Production agents need both.*

---

## What it is

<!-- TODO: Issue #121 — Level 1 article content -->

_This article is coming in v1.6.0. See [issue #121](https://github.com/fworks-tech/agenthood/issues/121)._

**Covers:** What vector databases are, how embeddings enable semantic similarity search, and why Agenthood chose LanceDB (ADR-010) as the default vector store for local-first, production-ready storage.

---

## Why it matters in production

<!-- TODO: Issue #121 -->

---

## How Agenthood implements it

<!-- TODO: Issue #121 -->

**Maps to:** `src/memory/stores/VectorStore.ts` _(coming in v2.1.0)_, ADR-010 (LanceDB)

---

## Hands-on example

<!-- TODO: Issue #121 -->

---

## Further reading

- [ADR-010 — LanceDB for vector storage](../../docs/adr/) _(coming in v2.0.0)_
- `src/memory/stores/VectorStore.ts` — LanceDB integration _(v2.1.0)_
- [LanceDB documentation](https://lancedb.github.io/lancedb/) — the embedded vector database Agenthood uses

---

## LinkedIn version

**Hook:** Most developers discover they needed a vector database after they needed a vector database.

**Why it matters:**
- SQL cannot answer "what is most similar to this?" — vectors can
- Managed vector databases add cost and latency; embedded ones (LanceDB) do not
- Agenthood stores embeddings locally — no API key, no rate limits, no vendor dependency

**→** [Read the full article →](https://fworks-tech.github.io/agenthood/academy/level-1-genai-rag-basics/07-vector-databases/)
