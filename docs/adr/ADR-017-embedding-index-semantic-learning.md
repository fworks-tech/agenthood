# ADR-017: Semantic Learning via Embedding Index

**Date:** 2026-08-14
**Status:** Accepted

## Context

Issue #313 asked for a persistent embedding index feeding EpisodeLearner's
semantic-first path. The audit that preceded this work found the pieces the
issue assumed did not exist in the expected shape:

1. `SemanticPatternMatcher` (#312) persists `pattern:` rows with **JSON
   outcome** content and matches via an **in-memory linear cosine scan** over
   records loaded at `initialize()` — the real LanceDB ANN path
   (`IVectorStore.search`) is never used by the matcher.
2. The matcher is **dead code in production**: nothing constructs it, so
   EpisodeLearner's semantic-first branch can never fire in `agenthood run`.
3. LongTermMemory rows (`ltm:learnings/*`) were written with **zero vectors**,
   so they are invisible to any similarity query.
4. A real-store test uncovered that filtered ANN searches silently returned
   nothing: `toSqlFilter` wrapped the filter value in quotes *outside* the
   LIKE literal and inserted a space after the key colon that JSON metadata
   never contains.

## Decision

1. **New primitive, not matcher reuse.** `EmbeddingIndex` (src/evals/
   EmbeddingIndex.ts) owns persistence and ANN similarity: `storePattern`
   upserts by a key derived from the pattern text (delete-then-add, no
   duplicate rows), `findSimilar` queries `IVectorStore.search` with a
   `learned_pattern` metadata filter, threshold (default 0.85, inclusive),
   and limit. Content is the **pattern text**, not the JSON outcome — the
   learner only consumes `.pattern` from matches, so text storage is
   sufficient and keeps the primitive provider-agnostic.
2. **SemanticPatternMatcher is retained unchanged.** Its tests encode a
   contract (JSON-outcome content, initialize + linear scan) that delegation
   would rewrite. It stays exported for compatibility; EpisodeLearner no
   longer calls it. Both write `pattern:` rows derived from the same hash —
   the learner uses the index exclusively in production, so the overlap is
   inert.
3. **EpisodeLearner queries the index before the hash fallback.** The
   semantic-first ordering already existed in `storeOutcome`; it now calls
   `index.findSimilar(embed(episode))` and, on no match, stores
   `embed(pattern)` via `index.storePattern`. Any failure (no provider,
   Anthropic's unsupported embed, store down) degrades to the hash fallback —
   learning never blocks a run.
4. **Versioned re-index migration.** A marker row (`__index_version__`,
   metadata type `index_version`, zero vector) records the index format.
   `reindexLegacyPatterns` re-embeds `ltm:learnings/*` and
   `ltm:antipatterns/*` rows as `pattern:` rows and writes the marker. It
   runs best-effort at `ApplicationContext.create`, is idempotent (upserts),
   and retries next process if embedding is unavailable. LTM rows are left
   untouched — the migration is additive.
5. **Fix `toSqlFilter`.** Values are embedded inside the LIKE literal with
   their JSON quoting (`%"type":"value"%`), so filtered searches actually
   match. `IVectorStore.delete` now types its `string | Record` union, which
   the implementation already supported.

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|-------------|
| Delegate SemanticPatternMatcher to EmbeddingIndex | Removes linear-scan duplication | Rewrites the matcher's tested contract (JSON content, initialize-load) | Tests encode behavior that predates the index; churn without user value |
| Single-writer consolidation (matcher deleted) | No dual storage | Breaking API; matcher is exported and documented | Retained for backward compatibility per issue scope |
| Migration rewrites LTM rows in place | One canonical copy | Mutates the memory store semantics; LTM is key-value, not similarity | Additive pattern rows keep LTM intact |

## Consequences

- Every filtered vector search in the codebase now works (LongTermMemory
  retrieve, DecisionSearch, index queries) instead of silently returning [].
- `agenthood run` gains production semantic learning when a provider with
  `embed` is configured; otherwise behavior is unchanged.
- The migration costs one embed call per legacy pattern; it is capped by
  being best-effort and deferred across processes when the provider is down.
- ResidualMemory production wiring remains out of scope (deferred follow-up);
  the learner already tolerates its absence.
