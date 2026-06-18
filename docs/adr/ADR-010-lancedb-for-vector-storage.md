# ADR-010: LanceDB for Vector Storage

**Date:** 2026-06-02
**Status:** Accepted

## Context

Agentic RAG (retrieval-augmented generation) requires a vector store for embedding
and retrieving documents. The v2 TypeScript runtime (ADR-008) needs one that:
- Runs embedded (no external server to provision or operate)
- Works in Node.js without native-module build issues
- Supports metadata filtering alongside vector search
- Has zero infrastructure cost for adopters

External managed services (Pinecone, Weaviate Cloud) were ruled out immediately —
they require accounts, API keys, and ongoing cost. The choice is between embedded
options that ship inside the npm package.

## Decision

LanceDB is the default vector store, implemented in `src/memory/VectorStore.ts`.
It is embedded, file-based (persists to `.agenthood/memory/`), and has a Node.js
package that does not require native compilation on common platforms.

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|-------------|
| Pinecone | Managed; scalable | External service; paid; requires API key | Fails the zero-infrastructure requirement |
| Weaviate (embedded) | Feature-rich; GraphQL API | Heavy; complex setup for embedded mode | Overkill for v2 scope |
| `hnswlib-node` | Pure HNSW; lightweight | No metadata filtering; manual persistence | Missing filtering capability |
| `chromadb` (embedded) | Python-native; popular | Python dependency; poor Node.js embedded story | Conflicts with ADR-008 TS-only decision |
| LanceDB (chosen) | Embedded; Node.js native; metadata filtering; Apache Arrow columnar format | Younger ecosystem; fewer integrations | — |

## Consequences

**Easier:**
- No infrastructure required — vector data persists to a local directory
- Metadata filtering is native, enabling hybrid keyword + semantic search
- Single npm dependency; no Python runtime needed (consistent with ADR-008)

**Harder:**
- LanceDB Node.js bindings are in earlier maturity than the Python client
- Arrow columnar format is unfamiliar to most TypeScript contributors
- Distributed / multi-node scenarios require migrating to an external store

**Scope:**
LanceDB handles the default `VectorStore` implementation. `IVectorStore` abstraction
allows adopters to swap to Pinecone, Weaviate, or any other provider via config.

## References

- [ADR-008](ADR-008-typescript-runtime-over-python.md) — TypeScript runtime this store ships with
- [ADR-009](ADR-009-groq-as-default-llm-provider.md) — companion LLM provider decision
- [Academy: Vector Databases](../academy/level-1-genai-rag-basics/07-vector-databases.md)
