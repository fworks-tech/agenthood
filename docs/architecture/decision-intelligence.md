# Decision Intelligence and Provenance

> *Every decision, recorded for posterity — and provable.*

The society's members make consequential decisions during every `agenthood run`.
This document describes the layer that records those decisions, links them
causally, tracks their provenance, and makes them searchable — so "why did the
society do X?" always has an answer. Design patterns are studied from
[semantica-agi/semantica](https://github.com/semantica-agi/semantica) (MIT);
the implementation is TS-native with zero new dependencies
([ADR-015](../adr/ADR-015-decision-intelligence-and-provenance.md)).

---

## What Gets Recorded

Every member run (`agenthood run <member> "task"`) persists exactly two
records, on success **or** failure:

| Record | Store | Location | Shape |
|--------|-------|----------|-------|
| Decision | `DecisionLog` | `.agenthood/decisions/<id>.json` | `member`, `task`, `decision`, `rationale`, `outcome`, `tags`, `confidence`, `decisionMaker`, `validFrom/Until` |
| Provenance | `ProvenanceStore` | `.agenthood/provenance/<entityId>.json` | `entityId` (= run `executionId`), `activityId` (`run:<role>`), `agentId`, `agentType`, `role`, `sourceDocument`, `confidence`, SHA-256 `checksum` |

Recording is non-fatal: a failure to record logs a warning but never fails the
run.

## Causal Relationships

Decisions link to each other with typed edges, mirroring Semantica's
relationship model:

- `CAUSED` — the source decision caused the target
- `INFLUENCED` — the source decision influenced (but did not cause) the target
- `PRECEDENT_FOR` — the source decision is precedent for the target

Edges persist in `.agenthood/decisions/edges.json` and drive two queries:

- `traceDecisionChain(id)` — full causal ancestry, from root cause to the
  decision (post-order, cycle-safe)
- `analyzeDecisionImpact(id)` — everything downstream of the decision (BFS,
  cycle-safe)

## Provenance Integrity

Provenance entries form a tamper-evident hash chain. Each entry records:

- `sequenceId` — global insertion order
- `previousChecksum` — the checksum of the previous entry
- `checksum` — SHA-256 over the canonical entry payload (excluding checksum,
  sequence, and invalidation fields) concatenated with `previousChecksum`

`verifyChain()` re-reads every entry **from disk** (never the in-memory cache)
and returns the first broken entry — a modified entry fails its checksum, a
deleted entry fails its linkage. `invalidate(entityId, by, reason)` tombstones
an entry instead of deleting it, so the fact that the entry existed remains
provable; invalidation fields are excluded from the checksum so tombstones do
not break the chain.

## Precedent Search

`DecisionSearch` makes past decisions findable by meaning:

1. `indexAll(decisions, embedder)` — embeds each decision's task + decision
   text with the runtime's existing `ILLMProvider.embed()` and stores the
   vectors in the LanceDB vector store (ADR-010), keyed `decision:<id>`
2. `search(decisions, query, embedder, topK)` — embeds the query and returns
   the matching decision entries with scores

Indexing is on-demand, never on the member-run hot path.

## Time Travel

`GraphSnapshot` version the society graph:

- `take(graph)` — writes `.agenthood/snapshots/society-graph-<epoch-ms>.json`
  after each member run
- `stateAt(date)` — loads the latest snapshot at or before a date, answering
  "what did the society know on <date>?"

## Design Constraints

- **Zero new dependencies** — everything reuses `node:fs`, `node:crypto`,
  LanceDB, and the existing embedder
- **Backward compatible** — pre-existing decision files without the new fields
  load unchanged; `edges.json` is never treated as a decision entry
- **Off the hot path** — provenance recording adds only small sync writes;
  embedding/precedent indexing is explicit and on-demand
- **Not built (gated)** — deterministic rule engine, policy gates, and
  conflict detection are documented in ADR-015 as future work, gated on a
  code-level consumer (the Doorman's enforcement is already deterministic via
  ADR-003)
