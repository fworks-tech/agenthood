# Vector Databases

> Keyword search finds the words you typed. Vector search finds the meaning you intended.

---

## What it is

A Vector Database is a specialized storage system designed to hold high-dimensional mathematical representations of data (vectors or embeddings). When text is converted into an embedding, words with similar semantic meanings are placed closer together in mathematical space.

Unlike relational databases (SQL) that rely on exact keyword matches, vector databases perform "similarity searches." If you search for "dog," it will return documents about "puppies" and "canines" because their vectors are grouped near each other.

---

## Why it matters in production

Traditional search fails when users ask natural language questions ("How do I fix the auth bug?"). RAG pipelines require the ability to retrieve documents based on semantic relevance, not exact text matches.

In production, vector databases provide the blazing-fast similarity search that makes real-time agentic workflows possible. Without them, comparing a query against thousands of codebase chunks would be computationally paralyzing.

---

## How Agenthood implements it

Agenthood implements vector storage using LanceDB, an embedded, high-performance vector database that requires no external infrastructure. This aligns with the Society's principle of lightweight, local-first tooling.

This integration is managed via the `IVectorStore` interface in `src/memory/VectorStore.ts` using `@lancedb/lancedb` v0.30.0 (see ADR-010):

```typescript
import { LanceDBStore } from 'agenthood';

const store = new LanceDBStore(1536);
await store.connect('.agenthood/memory');
await store.add([
  { id: 'doc-1', vector: embedding, content: 'document text', metadata: { source: 'docs' }, createdAt: new Date() },
]);
const results = await store.search(queryVector, 5, { source: 'docs' });
```

No heavy cloud infrastructure. No external dependencies. Just fast, local semantic search.

---

## Hands-on example

You interact with the local vector store transparently through the runtime:

```bash
# Initialize local vector storage
# No dedicated CLI subcommand — LanceDB initializes on first use

# The database lives in .agenthood/memory/
ls -la .agenthood/memory/
```

Or conceptually in TypeScript:

```typescript
// The local embedded nature of LanceDB makes this seamless
const db = new LanceDBStore('.agenthood/memory');
await db.insert(chunks);
```

---

## Further reading

- [ADR-010 — LanceDB for Vector Storage](../../adr/ADR-010-lancedb-for-vector-storage.md)
- [`src/memory/VectorStore.ts`](../../../src/memory/VectorStore.ts) — IVectorStore interface + LanceDBStore (shipped)
- [LanceDB Documentation](https://lancedb.github.io/lancedb/) — why embedded vector DBs are the future


