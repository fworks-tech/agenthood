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

This integration will be managed via the `VectorStore` interface in `src/rag/VectorStore.ts` (future milestone, outlined in ADR-010):

```typescript
// Planned for a future milestone
import * as lancedb from 'vectordb';

export class LanceDBStore implements VectorStore {
  async search(queryVector: number[], options: SearchOptions) {
    const table = await this.db.openTable('codebase');
    return await table.search(queryVector).limit(options.topK).execute();
  }
}
```

No heavy cloud infrastructure. No external dependencies. Just fast, local semantic search.

---

## Hands-on example

When the RAG tools are introduced, you will interact with the local vector store transparently:

```bash
# Initialize local vector storage
npx agenthood rag:init-db

# The database lives in .agenthood/vectors/
ls -la .agenthood/vectors/
```

Or conceptually in TypeScript:

```typescript
// The local embedded nature of LanceDB makes this seamless
const db = new LanceDBStore('.agenthood/vectors');
await db.insert(chunks);
```

---

## Further reading

- [ADR-010 — RAG Architecture (Planned)](../../docs/adr/ADR-010-rag-architecture.md)
- [`src/rag/VectorStore.ts`](../../src/rag/VectorStore.ts) — source implementation (planned)
- [LanceDB Documentation](https://lancedb.github.io/lancedb/) — why embedded vector DBs are the future

---

## LinkedIn version

**Hook:** Keyword search finds the words you typed. Vector search finds the meaning you intended.

**Why it matters:**
- Users ask natural language questions, not exact keyword queries
- Vector DBs allow agents to find related concepts instantly
- Embedded vector DBs like LanceDB keep your architecture lightweight and local

**→** [Read the full article + implementation walkthrough →](https://fworks-tech.github.io/agenthood/academy/level-1-genai-rag-basics/07-vector-databases/)
