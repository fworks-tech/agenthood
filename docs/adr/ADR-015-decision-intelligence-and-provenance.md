# ADR-015: Decision Intelligence and Provenance

**Date:** 2026-08-11
**Status:** Accepted

## Context

The society had no persistent record of what its members decided and why. ADRs
and git history capture the outcomes of human decisions, but decisions made
during `agenthood run <member>` were ephemeral: the `DecisionLog` schema existed
(`src/memory/DecisionLog.ts`) but was never written from any code path, the
`Tracer` in `run.ts` was a no-op, and there was no way to answer "why did the
society do X?", reuse a past member decision as precedent, or prove an audit
trail was untampered.

The design patterns for this class of problem were studied in
[semantica-agi/semantica](https://github.com/semantica-agi/semantica) (MIT
licensed) — specifically its decision data model (`Decision`, `Precedent`,
`Policy`), causal relationship tracking (`CAUSED` / `INFLUENCED` /
`PRECEDENT_FOR`, `trace_decision_chain`, `analyze_decision_impact`), and
W3C PROV-O-style provenance entries with hash-chain integrity. Semantica itself
is Python-first and heavy (RDF stores, SPARQL, OWL, polyglot graph backends) —
adopting it as a dependency would violate ADR-008 (single TypeScript stack) and
the zero-infrastructure doctrine (ADR-010, ADR-011). The decision is to
reimplement the *patterns*, not the package, natively in TypeScript.

## Decision

The runtime gains a decision intelligence and provenance layer, all TS-native,
zero new dependencies, JSON-per-file persistence under `.agenthood/`:

- **`DecisionLog` (extended, `src/memory/DecisionLog.ts`)** — the existing
  schema is extended additively with `confidence`, `decisionMaker`,
  `validFrom`, `validUntil`, and `reasoningEmbedding`. New methods:
  `addCausalRelationship(source, target, CAUSED|INFLUENCED|PRECEDENT_FOR)`,
  `traceDecisionChain(id)` (causal ancestry), `analyzeDecisionImpact(id)`
  (downstream influence), `all()`. Causal edges persist in
  `.agenthood/decisions/edges.json`.
- **`ProvenanceStore` (new, `src/memory/ProvenanceStore.ts`)** — one
  provenance entry per member run, stored in `.agenthood/provenance/`. Entries
  carry `entityId`, `activityId`, `agentId`, `agentType`
  (`person|software_agent|organization`), `role`, `sourceDocument`,
  `confidence`, and a SHA-256 hash chain: each entry's `checksum` commits the
  previous entry's checksum via `previousChecksum` + `sequenceId`.
  `verifyChain()` re-reads from disk (never the in-memory cache) and detects
  tampered or deleted entries. `invalidate()` tombstones an entry instead of
  deleting it; invalidation fields are excluded from the checksum so
  tombstones do not break the chain.
- **Per-run recording (`src/agents/base/BaseAgent.ts`)** — every member run
  records exactly one decision and one provenance entry (success or failure),
  non-fatally; `activityId` is `run:<role>`, `entityId` is the run's
  `executionId`. Recording failure logs and does not fail the run.
- **Tracer (implemented, `src/commands/run.ts`)** — the no-op tracer now
  collects span start events in memory; span collection is intentionally
  minimal with no span record store.
- **`DecisionSearch` (new, `src/memory/DecisionSearch.ts`)** — precedent
  search: embeds decision scenarios with the existing `ILLMProvider.embed()`
  and searches them through the existing LanceDB `IVectorStore`
  (ADR-010), zero new infrastructure.
- **`GraphSnapshot` (new, `src/memory/GraphSnapshot.ts`)** — point-in-time
  snapshots of the society graph: `take()` writes
  `.agenthood/snapshots/society-graph-<epoch-ms>.json` after each member run;
  `stateAt(date)` loads the latest snapshot at or before a date.

Backward compatibility is mandatory: pre-existing decision files without the
new fields must load unchanged, and `edges.json` is excluded from the entry
cache.

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|-------------|
| Adopt Semantica as a Python sidecar | Full feature set: RDF, SHACL, reasoning engines | Reopens the two-stack problem killed in ADR-006/007/008; external service to operate; violates zero-infrastructure doctrine | Contradicts ADR-008 and ADR-010 |
| Adopt Semantica via MCP server | Drop-in tool access | Same operational burden; MCP server written in Python | Same rejection as above |
| TS-native reimplementation (chosen) | Single stack; zero dependencies; matches existing `DecisionLog`/LanceDB seams; small surface | Rebuilds a subset of Semantica's features | Chosen — the subset is small, deterministic, and testable |
| Status quo (DecisionLog stays dead code) | No work | No audit trail, no precedent, no provenance | Rejected — the schema already existed; only wiring was missing |

## Consequences

**Easier:**
- Every member run is now auditable: decision + provenance entries land on
  disk, and `verifyChain()` proves integrity against tampering.
- Causal chains answer "why did the society make this choice?" and "what did
  this decision affect?".
- Precedent search and time-travel snapshots reuse existing infrastructure
  (LanceDB, embedder, society graph).
- Old decision files remain readable; the change is additive.

**Harder:**
- Every member run writes 2+ small JSON files and a society-graph snapshot —
  a small, bounded latency and disk cost (acceptance gate: < 50 ms median
  added latency).
- `verifyChain()` is only as good as its last run; nothing continuously
  audits the chain — a future ritual or CI check can call it.

**Deferred (gated, not built):**
- Deterministic rule engine (`RuleEngine`), policy gates with exceptions
  (`PolicyGate`), and conflict detection (`ConflictDetector`) were studied
  from Semantica but are **not** implemented. The Doorman's enforcement is
  already deterministic via ADR-003 (commitlint + githooks); the Warden and
  Sentinel are prompt-only. These abstractions only earn their place when a
  code-level consumer exists (e.g., Warden/Sentinel checks implemented in
  code). Per the society's own rule, no abstraction beyond what the task
  requires.
- W3C PROV-O/RDF export of provenance entries (structured JSON is the
  contract for now).

## References

- [ADR-008](ADR-008-typescript-runtime-over-python.md) — TypeScript-only runtime
- [ADR-010](ADR-010-lancedb-for-vector-storage.md) — LanceDB vector store reused by DecisionSearch
- [ADR-003](ADR-003-dual-enforcement-hooks-and-commitlint.md) — existing deterministic enforcement (gates the rule engine)
- [semantica-agi/semantica](https://github.com/semantica-agi/semantica) (MIT) — design patterns studied for decision models, causal relationships, and provenance
- `src/memory/DecisionLog.ts`, `src/memory/ProvenanceStore.ts`, `src/memory/DecisionSearch.ts`, `src/memory/GraphSnapshot.ts`
- `src/agents/base/BaseAgent.ts` — per-run recording
