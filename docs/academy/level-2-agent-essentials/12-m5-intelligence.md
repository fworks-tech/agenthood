# M5 — Intelligence: What Shipped

> *M5 turns planned reasoning into shipped code. The Society no longer just plans — it decides, retrieves, and routes.*

---

## What shipped

The M5 milestone ("Intelligence") delivered four features that close the gap between the Academy's architecture docs and working code:

| Component | File | Status |
|-----------|------|--------|
| `MarkdownHierarchicalChunkStrategy` | `src/rag/ChunkStrategy.ts` | v2.6.0 |
| `AgenticRAG` | `src/rag/AgenticRAG.ts` | v2.6.0 |
| `RetrievalClassifier` | `src/skills/rag/RetrievalClassifier.ts` | v2.6.0 |
| `MemberOrchestrator` (Phase 1) | `src/reasoning/MemberOrchestrator.ts` | v2.6.0 |

---

## How they work together

The three retrieval components form a pipeline that replaces passive RAG with a decision-aware retrieval system:

1. **Chunk with structure** — `MarkdownHierarchicalChunkStrategy` splits documents by heading boundaries, producing parent sections and child chunks with structural metadata.
2. **Index with provenance** — child chunks are embedded for vector search; parent sections are linked to their children. Every result knows which section it came from.
3. **Retrieve with strategy** — `RetrievalClassifier` inspects the query and context and decides the retrieval strategy (`vector`, `graph`, `skip`). `AgenticRAG` executes that decision, querying the vector store, the knowledge graph, or neither.

`MemberOrchestrator` is a separate concern — it detects which Society member should handle a task based on keywords, changed files, and task stage. It does not share code with the RAG pipeline, but both feed into the agent's reasoning loop.

---

## Code: MarkdownHierarchicalChunkStrategy

```typescript
import { MarkdownHierarchicalChunkStrategy } from 'agenthood';

const strategy = new MarkdownHierarchicalChunkStrategy();
const { parents, children } = strategy.chunk(markdownContent, {
  filePath: 'docs/api/reference.md',
  startLine: 1,
  endLine: 200,
});

// parents: section-level chunks (e.g. "## Authentication")
// children: fixed-size sub-chunks, each linked to its parent section
```

Each parent chunk represents a markdown heading section (##). Each child chunk is a fixed-size sub-segment that inherits the parent's file path and line range — so vector search results can be traced back to the exact section they came from.

---

## Code: AgenticRAG

```typescript
import { AgenticRAG } from 'agenthood';
import type { ILLMProvider } from 'agenthood';
import type { IVectorStore } from 'agenthood';

const rag = new AgenticRAG({
  embedder: llmProvider,           // ILLMProvider
  vectorStore: lanceVectorStore,   // IVectorStore
  knowledgeGraphStore: graphStore, // IGraphStore (optional)
});

const results = await rag.retrieve(
  'How does BaseAgent relate to ReActLoop?',
  executionContext
);
// strategy: 'graph' — relationship question routes to the knowledge graph
// results[0].sourcePaths: ['BaseAgent -> ReActLoop']
```

The `RetrievalClassifier` runs internally on every call. You can pass a custom classifier to override the default strategy selection.

---

## Code: MemberOrchestrator.detectMembers()

```typescript
import { MemberOrchestrator } from 'agenthood';

const orchestrator = new MemberOrchestrator();
const members = orchestrator.detectMembers({
  userMessage: 'review the security of the OAuth middleware',
  changedFiles: ['src/middleware/auth.ts'],
  currentStage: 'review',
});

// [
//   { member: 'the-auditor', score: 6, matchedKeywords: ['security'], ... },
//   { member: 'the-reviewer', score: 4, matchedKeywords: ['review'], ... },
// ]

const lead = orchestrator.getDefaultMember(members);
// 'the-auditor'
```

Phase 1 implements keyword-based member detection and stage routing, used by The Steward to route tasks to the right Society member.

---

## What comes next

The M5 gap items — `WorkflowEngine` orchestration, `TreeOfThought` branching, and full `ParallelStep` support — remain planned for subsequent milestones. `MemberOrchestrator` Phase 2 (dependency-based routing) and Phase 3 (learned routing from past run data) are also on the roadmap.

---

## Further reading

- [`src/rag/AgenticRAG.ts`](../../../src/rag/AgenticRAG.ts) — the Agentic RAG orchestrator (v2.6.0)
- [`src/rag/ChunkStrategy.ts`](../../../src/rag/ChunkStrategy.ts) — `MarkdownHierarchicalChunkStrategy` (v2.6.0)
- [`src/skills/rag/RetrievalClassifier.ts`](../../../src/skills/rag/RetrievalClassifier.ts) — strategy classifier (v2.6.0)
- [`src/reasoning/MemberOrchestrator.ts`](../../../src/reasoning/MemberOrchestrator.ts) — member detection (v2.6.0)
- [ADR-005 — Orchestrator pattern over peer-to-peer](../../adr/ADR-005-orchestrator-pattern.md) — the architectural decision that `MemberOrchestrator` Phase 1 implements
- [`docs/academy/level-2-agent-essentials/09-agentic-rag.md`](09-agentic-rag.md) — full conceptual walkthrough of Agentic RAG
