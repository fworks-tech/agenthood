# Vector Databases

> Keyword search matches the words you typed. Vector search matches what you meant.

---

## What it is

A Vector Database is a specialized storage system designed to hold high-dimensional mathematical representations of data (vectors or embeddings). When text is converted into an embedding, words with similar semantic meanings are placed closer together in mathematical space.

Unlike relational databases (SQL) that rely on exact keyword matches, vector databases perform "similarity searches." If you search for "dog," it will return documents about "puppies" and "canines" because their vectors are grouped near each other.

---

## Why it matters in production

Keyword search fails on natural-language questions such as "How do I fix the auth bug?". A RAG pipeline needs to retrieve documents by semantic relevance, not by exact text match.

In production, a vector database makes similarity search fast enough for real-time agent workflows. Without one, comparing a query against thousands of codebase chunks is too slow to use.

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

It needs no cloud infrastructure and no external service. Semantic search runs locally.

---

## Hands-on example

You interact with the local vector store transparently through the runtime:

```bash
# Initialize local vector storage
# No dedicated CLI subcommand: LanceDB initializes on first use

# The database lives in .agenthood/memory/
ls -la .agenthood/memory/
```

Or conceptually in TypeScript:

```typescript
// The local embedded nature of LanceDB means there is no server to run
const db = new LanceDBStore(1536);
await db.connect('.agenthood/memory');
await db.add(chunks);
```

---

## Further reading

- [ADR-010: LanceDB for Vector Storage](../../adr/ADR-010-lancedb-for-vector-storage.md)
- [`src/memory/VectorStore.ts`](../../../src/memory/VectorStore.ts): IVectorStore interface + LanceDBStore (shipped)
- [LanceDB Documentation](https://lancedb.github.io/lancedb/): why embedded vector DBs are the future


