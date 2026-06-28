# ADR-014: EvalResult in Core Types

**Date:** 2026-06-28
**Status:** Accepted

## Context

The `EpisodeLearner` feature (issue #119) needs a contract for passing evaluation
results from an evaluator (future `EvalRunner`) to the learner. Two questions
arose: what shape should this contract take, and where should it live?

The codebase already defines shared interfaces in `src/core/types.ts` —
`ShortTermMemory`, `LongTermMemory`, `EpisodicMemory`, `ProjectMemory`,
`DecisionLog` — all consumed by `ExecutionContext` and agents.

Two placement options were considered: define `EvalResult` locally inside
`EpisodeLearner.ts` (tight coupling, simpler now), or put it in `core/types.ts`
(shared contract, better for when `EvalRunner` is built later).

## Decision

Define `EvalResult` in `src/core/types.ts` alongside the other shared
interfaces.

```typescript
export interface EvalResult {
  episodeId: string
  scores: Record<string, number>
  durationMs?: number
  metadata?: {
    member?: string
    skill?: string
    task?: string
  }
}
```

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|-------------|
| Local to `EpisodeLearner.ts` | No changes to core; simpler diff | Forces future `EvalRunner` to import from evals layer or duplicate the type; coupling direction would be wrong | EvalRunner (also in evals/) and EpisodeLearner share the same layer; the type is a cross-cutting concern |
| In `core/types.ts` | Single source of truth; accessible to agents, evals, and orchestrators; follows existing pattern | Adds eval concern to core, but the type is small (~10 lines) and stable | Chosen — the pattern of shared interfaces in core is already established |

## Consequences

- `EvalResult` is available to all layers without cross-layer imports.
- `core/types.ts` gains an eval-adjacent type, but at only ~10 lines this is
  acceptable — the file already hosts `Artifact`, `Tracer`, and memory interfaces.
- A future `EvalRunner` can import `EvalResult` from core without creating a
  circular dependency.
- If `EvalResult` grows significantly beyond its current shape, extraction into
  `src/core/eval.ts` can be done without breaking consumers.

## References

- Issue #119 — EpisodeLearner implementation
- `src/core/types.ts` — existing shared interfaces
- `src/evals/EpisodeLearner.ts` — consumer of EvalResult
