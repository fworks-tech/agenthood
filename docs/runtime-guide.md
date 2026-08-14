# Runtime Guide

## Provider Failover Configuration

The runtime supports automatic provider failover when a provider fails (rate limit, outage, auth error). Configure an ordered list of providers in `.agenthood/config.json`:

```json
{
  "providers": [
    {
      "name": "opencode",
      "model": "deepseek-v4-flash",
      "priority": 1
    },
    {
      "name": "opencode-go",
      "model": "deepseek-v4-flash",
      "priority": 2
    },
    {
      "name": "anthropic",
      "model": "claude-sonnet-5",
      "models": ["claude-sonnet-5", "claude-haiku-4-5"],
      "priority": 3
    },
    {
      "name": "groq",
      "model": "llama-3.3-70b-versatile",
      "priority": 4
    },
    {
      "name": "openrouter",
      "model": "openai/gpt-4o-mini",
      "priority": 5
    },
    {
      "name": "ollama",
      "model": "llama3.2",
      "baseUrl": "http://localhost:11434",
      "priority": 6
    }
  ],

  "_comment_failover": "Optional circuit breaker and probe recovery settings",
  "failover": {
    "failureThreshold": 3,
    "cooldownMs": 60000,
    "probeEnabled": true
  }
}
```

- **`providers[]`** — Ordered list of LLM providers. First entry is primary, subsequent entries are fallbacks tried in order. Each entry supports `models[]` for model downgrade on failure.
- **Provider choice** — Prefer `opencode-go` (Go) over `opencode` (Zen).
- **`failover`** (optional) — Circuit breaker tuning: `failureThreshold` (consecutive failures before skipping), `cooldownMs` (override cooldown), `probeEnabled` (enable/disable probe recovery).

See `.agenthood/config.example.json` for the complete reference.

## API Key Validation

The runtime validates LLM API keys at startup before making any provider calls. Only the configured provider's key is checked — if you set `provider` to `"ollama"`, no key validation is performed.

The runtime automatically loads environment variables from a `.env` file in the project root (via `dotenv`).

Key resolution order (per provider):
1. `providers[].apiKey` — key in config array entry
2. `apiKey` — top-level key in config
3. `process.env.<VAR>` — environment variables (including those loaded from `.env`)

Supported environment variables:
- `OPENCODE_API_KEY` — OpenCode / OpenCodeGo
- `OPENAI_API_KEY` — OpenAI
- `ANTHROPIC_API_KEY` — Anthropic
- `GROQ_API_KEY` — Groq
- `OPENROUTER_API_KEY` — OpenRouter

If no key is found and the provider requires one, startup fails with:
```
OPENCODE_API_KEY not set for provider "opencode". Get a key at https://opencode.ai/auth
```

Run `npx agenthood check` to verify API key configuration as part of a full health check.

### Ollama / Local Providers

Providers not in the known key list (ollama, custom-local) skip key validation entirely — no key required.

## Memory & Vector Store

The runtime includes a tiered memory system and a vector store, all persisted locally:

### Memory Store

Pre-configured paths used by the runtime for memory persistence:

| Path | Store | Purpose |
|------|-------|---------|
| `.agenthood/memory/` | LanceDB vector store (embedded) | Vector embeddings, semantic search, metadata filtering |
| `.agenthood/residual.json` | ResidualMemory | Decay-weighted trace signals from past agent runs |
| `.agenthood/society-graph.json` | KnowledgeGraphStore | Bidirectional structural relationships between entities |
| `.agenthood/decisions/` | DecisionLog | Per-run decision records + `edges.json` causal links |
| `.agenthood/provenance/` | ProvenanceStore | Tamper-evident provenance entries (SHA-256 hash chain) |
| `.agenthood/snapshots/` | GraphSnapshot | Versioned society-graph snapshots (`society-graph-<epoch-ms>.json`) |

The `IMemoryStore` interface at `src/memory/IMemoryStore.ts` unifies all memory tiers with common operations (`set`, `get`, `delete`, `has`, `prune`, `stats`). The `InMemoryStore` provides a synchronous TTL/LRU store for in-process caching. `LanceDBStore` (in `src/memory/VectorStore.ts`) implements both `IVectorStore` (vector search) and `IMemoryStore<VectorRecord>` (key-value access by id).

### Decision Intelligence & Provenance

Every member run records exactly one decision and one provenance entry (on
success **or** failure), linked by the run's `executionId`:

```typescript
import { DecisionLog, ProvenanceStore, DecisionSearch, GraphSnapshot } from 'src/memory'

const decisions = new DecisionLog()                      // .agenthood/decisions/
const provenance = new ProvenanceStore()                 // .agenthood/provenance/

// Causal links between decisions (CAUSED | INFLUENCED | PRECEDENT_FOR)
await decisions.addCausalRelationship('dec-001', 'dec-002', 'CAUSED')
const chain = await decisions.traceDecisionChain('dec-002')   // ancestry
const impact = await decisions.analyzeDecisionImpact('dec-001') // descendants

// Provenance integrity — reads from disk, never the cache
const result = await provenance.verifyChain()             // { valid: true } or broken entry
await provenance.invalidate('exec-1', 'the-sentinel', 'source retracted') // tombstone

// Precedent search (on-demand; embeds via ILLMProvider.embed() into LanceDB)
const search = new DecisionSearch(vectorStore)
await search.indexAll(decisions, llm)
const hits = await search.search(decisions, 'storage choice', llm, 5)

// Time travel — "what did the society know on this date?"
const snapshotter = new GraphSnapshot()
snapshotter.take(societyGraph)                            // after each member run
const past = snapshotter.stateAt('2026-03-01T00:00:00.000Z')
```

See [decision-intelligence.md](architecture/decision-intelligence.md) for the
full design and [ADR-015](adr/ADR-015-decision-intelligence-and-provenance.md)
for the decision record.

### Residual Memory

`ResidualMemory` captures trace signals that no explicit tier claimed. It is automatically decayed at the start of each agent session and reinforced after each run. Decay follows an exponential rate (`decayRate ^ daysElapsed`), and signals below 0.1 strength are pruned automatically. The decayed signals are injected as soft context into the system prompt by `PromptBuilder`.

### Knowledge Graph

`KnowledgeGraphStore` stores named nodes and bidirectional relations. Use it for structural queries: "what connects these two components?" Path finding uses BFS and returns the shortest path. The graph persists to `.agenthood/society-graph.json`.

## RAG Pipeline

The runtime includes a modular RAG (Retrieval-Augmented Generation) pipeline for indexing and retrieving documents. The pipeline consists of three components:

### Chunk Strategy

`ChunkStrategy` defines how documents are split into chunks before embedding. The built-in `FixedSizeChunkStrategy` splits text by approximate token count (512 tokens default) with configurable overlap (64 tokens default). Token count is estimated as `characters / 4`.

```typescript
import { FixedSizeChunkStrategy } from 'src/rag/ChunkStrategy.ts'

const strategy = new FixedSizeChunkStrategy()
const chunks = strategy.chunk(documentText, { chunkSize: 512, overlap: 64 })
```

The `MarkdownHierarchicalChunkStrategy` implements parent-child chunking for Markdown documents. It splits by `##` section headers into parent chunks, then sub-splits each parent into fixed-size child chunks for embedding. On retrieval, child vector matches resolve to parent content for full context.

```typescript
import { MarkdownHierarchicalChunkStrategy } from 'src/rag/ChunkStrategy.ts'

const strategy = new MarkdownHierarchicalChunkStrategy()
const { parents, children } = strategy.chunk(documentText, { filePath: 'doc.md', startLine: 1, endLine: 100 })
```

### Indexer

`Indexer` chunks documents, embeds them via `ILLMProvider.embed()`, and stores the vectors in an `IVectorStore`. It supports both single-file and recursive directory indexing.

```typescript
import { Indexer } from 'src/rag/Indexer.ts'

const indexer = new Indexer({ embedder, vectorStore })
await indexer.indexDocument('/path/to/file.md', fileContent)
await indexer.indexDirectory('/path/to/project', (file) => file.endsWith('.md'))
const stats = indexer.stats()
// { totalDocuments: 10, totalChunks: 42, indexedExtensions: ['.md', '.ts'] }
```

### Retriever

`Retriever` takes a natural language query, embeds it, and searches the vector store for the most relevant chunks. Optional `KnowledgeGraphStore` integration enriches results with relationship context.

```typescript
import { Retriever } from 'src/rag/Retriever.ts'

const retriever = new Retriever(embedder, vectorStore, knowledgeGraphStore)
const results = await retriever.retrieve('how do I configure failover?', {
  topK: 5,
  minScore: 0.5,
  metadataFilter: { source: 'docs/runtime-guide.md' },
})
// Each result: { content, score, source, chunkIndex, graphContext?, metadata }
```

Results can be filtered by `minScore` (relevance threshold) and `metadataFilter` (field-level filtering). When a `KnowledgeGraphStore` is provided, results are enriched with the node's label, type, and neighbor relationships.

### Agentic RAG

`AgenticRAG` wraps the `Retriever` with a `RetrievalClassifier` that decides per-query whether to skip (answer from short-term memory), search vectors (semantic), traverse the knowledge graph (structural), or both. Each result includes provenance: which strategy was used, how many vector matches, graph hops, and source paths.

```typescript
import { AgenticRAG } from 'src/rag/AgenticRAG.ts'

const agenticRag = new AgenticRAG({ embedder, vectorStore, knowledgeGraphStore })
const results = await agenticRag.retrieve('how does failover work?', executionContext)
// Each result: { content, strategy, vectorMatches, graphHops, sourcePaths }
```

### Member Detection

`MemberOrchestrator` (Phase 1) detects which member(s) should handle a task based on keyword matching, changed file patterns, and task stage. It lives at `src/reasoning/MemberOrchestrator.ts` and supports all members.

```typescript
import { MemberOrchestrator } from 'src/reasoning/MemberOrchestrator.ts'

const orchestrator = new MemberOrchestrator()
const detected = orchestrator.detectMembers({
  userMessage: 'review this PR and check for security issues',
})
// [{ member: 'the-reviewer', score: 4 }, { member: 'the-auditor', score: 2 }]
```

## CLI Provider Override

Override the provider at runtime:

```bash
npx agenthood run <agent> "<task>" --provider ollama
npx agenthood run <agent> "<task>" --provider openrouter
```

This bypasses the configured provider chain and uses the specified provider directly.

### Memory Tiers

The memory model has five tiers (see [Academy: Agent Memory](academy/level-2-agent-essentials/05-agent-memory.md)): short-term, long-term, episodic, project, and residual. Of these, four implementations are wired into `ExecutionContext.memory` — residual traces exist in-process via `ResidualMemory` but are not wired into `ApplicationContext` — plus the decision and provenance stores:

| Tier | Implementation | Backing | Purpose |
|------|---------------|---------|---------|
| ShortTerm | `ShortTermMemoryImpl` | In-memory ring buffer | Recent conversation context (default capacity: 20 entries) |
| LongTerm | `LongTermMemoryImpl` | LanceDB VectorStore | Persistent key-value storage across sessions |
| Episodic | `EpisodicMemoryImpl` | LanceDB VectorStore + ILLMProvider | Episode recall with semantic search |
| Project | `ProjectMemoryImpl` | KnowledgeGraphStore + filesystem | Project conventions and architectural decisions |
| Residual | `ResidualMemory` | In-memory, optional JSON | Decay-weighted trace signals (not wired into `ApplicationContext`) |
| Decisions | `DecisionLog` | JSON files (`decisions/`) | Per-run decision records + causal edges |
| Provenance | `ProvenanceStore` | JSON files (`provenance/`) | Tamper-evident audit entries (hash chain) |

All seven are available via `src/memory/`; the five store-backed ones are wired into `ExecutionContext.memory` by `ApplicationContext.create()` in `src/runtime/ApplicationContext.ts` and available to every agent via `context.memory`. `BaseAgent` records one decision and one provenance entry per run.

### Society Index

`SocietyIndexer` indexes all Society members, ADRs, and conventions into a `KnowledgeGraphStore` and optionally into `VectorStore`. It is loaded by `agenthood run` at startup. The index persists to `.agenthood/society-graph.json`.

### Personalisation Store

`PersonalisationStore` stores per-project agent preferences: coding style, analysis depth, and primary domain. Preferences are set programmatically or inferred from `ResidualMemory` high-weight signals (the `agenthood init` prompts for personalisation were removed in 3.10).

Preferences are injected into the system prompt by `PromptBuilder` after residual memory hints:

```
Personalisation:
- style: concise (explicit)
- depth: high (explicit)
- domain: web (inferred)
```

Preferences persist to `.agenthood/preferences.json`.

## Observability & Evaluation

Every member invocation emits a trace envelope (member, duration, tokens, cost, quality, status, correlation id, raw input/output). Traces flush from the in-memory ring buffer (`Tracer`) to `.agenthood/traces/traces.ndjson` (`JSONFileTraceStore`) on a cadence and before process exit.

Inspect traces with:

```bash
npx agenthood trace                     # list recent envelopes (--member, --limit, --since, --json)
npx agenthood status --member <name>    # per-member cost/quality summaries over 1h/24h/7d/all
npx agenthood health                    # runtime health: tracer, store, registry, providers (exit 0/1/2)
npx agenthood status --learner          # EpisodeLearner band counts, trend, persisted patterns
```

Evaluate members against fixed suites with baseline gating:

```bash
npx agenthood eval the-reviewer --suite evals/benchmarks/review-pr.json --update-baseline
npx agenthood eval the-reviewer --suite evals/benchmarks/review-pr.json   # exit 1 on regression
```

Scores (faithfulness, relevance, context_recall via LLM-as-judge; answer_correctness via embedding cosine) aggregate into baselines at `.agenthood/baselines/<member>.json`, which also feed each member's per-trace `qualityScore`. Replay evaluation (`ReplayEvaluator`) re-runs historical envelopes against their stored inputs to surface behavior drift.

Privacy and lifecycle config in `.agenthood/config.json`:

```json
{
  "observability": {
    "redaction": { "enabled": true, "rules": [], "paths": ["/home/me"] },
    "retention": { "ttlDays": 30, "maxEntries": 100000, "exportEnabled": true, "exportPath": "./traces/export" },
    "alerts": { "costThreshold": 3.0, "qualityDrop": 0.2, "cooldownMinutes": 60 }
  },
  "sentry": { "dsn": "https://..." }
}
```

Redaction replaces emails, keys, tokens, URL query values, and IPs with deterministic placeholders before persistence (replay stays reproducible). Retention prunes by TTL and entry cap, exporting pruned data to NDJSON. Alerts drive `AnomalyDetector` (cost spikes, quality drops, bursts). Sentry captures member run failures when a DSN is set.

## Logging

When failover activates, the runtime logs provider selection to stderr:

```
Using anthropic (primary)
anthropic failed, falling back to groq
groq failed, falling back to ollama
All providers exhausted
```
