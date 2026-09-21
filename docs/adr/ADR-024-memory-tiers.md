# ADR-024: Tiered Memory Model with Per-Tier Bounds

**Date:** 2026-09-21
**Status:** Accepted

## Context

Members accumulate state during long sessions: recent turns, episodic records, learned
signals, decisions, and provenance. A single unbounded store per category risks OOM on
resource-constrained machines, while one shared store cannot serve the different access
patterns (recent-window vs. semantic recall vs. durable append-only audit).

## Decision

Memory is split into tiers, each with an explicit bound appropriate to its access pattern:

| Tier | Class | Bound |
|------|-------|-------|
| Working window | `ShortTermMemoryImpl` | fixed `capacity` (ring, default 20) + optional `ttlMs` window on reads |
| Episodes | `EpisodicMemoryImpl` | none in-process — every record goes to the vector store; recall is `topK`-capped |
| Residual signals | `ResidualMemory` | exponential decay by age; `pruneBelow(0.1)` now runs on every `record()`, not only at read |
| Decisions / provenance | `DecisionLog`, `ProvenanceStore` | append-only JSON files under `.agenthood/`, hash-chained (ADR-015) |

`ttlMs` defaults to `Infinity` so existing callers keep current behavior; the knob exists
for long-running hosts.

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|-------------|
| Single shared LRU | one mechanism | conflates durable audit with ephemeral window; provenance chain needs append-only | Rejected |
| Disk-backed everything | no OOM | kills per-turn latency of the working window | Rejected |
| No bounds (status quo ante) | zero work | record-only sessions grew signal maps unbounded (#645) | Rejected |

## Consequences

Easier: capacity policy is per-tier and testable; STM TTL semantics live in one filter.
Harder: more constructors to document; vector-store-side compaction (disk growth) is
deliberately out of scope and remains a possible future issue.

## References

- `src/memory/ShortTermMemory.ts`, `ResidualMemory.ts`, `EpisodicMemory.ts`
- Issue #645, PR #906; ADR-015 (decision intelligence and provenance)
