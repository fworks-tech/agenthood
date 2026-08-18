# ADR-016: LLM-as-Judge Evaluation Pipeline

**Date:** 2026-08-14
**Status:** Accepted

## Context

The M8 Observability milestone needed an evaluation engine (issues #310, #311,
#308, #298, #314) so the Society could measure — not just observe — member
output quality. Three constraints shaped the design:

1. Providers expose no structured JSON mode, so judge outputs must be parsed
   from plain text.
2. LLM judge calls cost tokens, so the fourth metric should avoid them.
3. Trace replay (#314) needs the raw input/output persisted, which conflicts
   with redaction (#305) — persisted payloads must stay re-runnable.

## Decision

Build an evaluation pipeline with a pluggable judge, per-member baselines, and
replay support:

- **EvalRunner** (`src/evals/EvalRunner.ts`) executes an injected `RunMemberFn`
  against every task in an `EvalSuite` and produces an `EvalReport` with
  per-task scores, status (completed/error/unevaluated), and aggregates.
- **EvalJudge / LLMJudge** (`src/evals/EvalJudge.ts`): three metrics
  (faithfulness, relevance, context_recall) are scored by an LLM-as-judge
  prompt that asks for a bare number between 0 and 1; the reply is parsed with
  a tolerant float extractor and clamped. `answer_correctness` uses embedding
  cosine similarity — no extra LLM call.
- **BaselineComparator** (`src/evals/BaselineComparator.ts`) persists per-member
  aggregate baselines at `.agenthood/baselines/<member>.json` and flags metrics
  whose aggregate drops beyond a threshold (default 0.1); the eval CLI
  (`agenthood eval`) exits non-zero on regression.
- **ReplayEvaluator** (`src/evals/ReplayEvaluator.ts`) re-runs a member against
  the stored inputs of historical envelopes and scores drift via embedding
  cosine between the stored and fresh outputs.
- **Redaction determinism** (`src/core/RedactionFilter.ts`): secrets are
  replaced with the fixed `[REDACTED]` placeholder so replayed inputs remain
  identical across runs and replay comparisons stay meaningful.

## Alternatives Considered

| Option | Why Considered | Why Rejected |
|--------|---------------|-------------|
| JSON-mode judge output | Structured parsing, no regex | Providers have no JSON mode; would need a provider-specific shim |
| LLM score for answer_correctness | Uniform metric implementation | Doubles judge cost per task; cosine is deterministic and free |
| Batch baseline from the evaluated window itself | No extra state | A single outlier can never exceed 3× the mean of a batch that includes itself — leave-one-out peer baselines are used instead |
| Redact with varying-length substitutes | Stronger privacy | Breaks replay reproducibility (#314) — replay input would change between runs |
| Replay without persisted raw text | Avoids PII surface | Impossible: envelopes stored only hashes (#314 acceptance requires re-running the same inputs) |

## Consequences

**Positive:** quality is measurable end-to-end (score → baseline → regression
gate); the judge is injectable so tests run without an LLM; replay surfaces
behavior drift; redaction and replay coexist through deterministic placeholders.

**Negative:** judge scores are heuristic — a model reply with no parseable
number marks the task unevaluated; embedding quality bounds
`answer_correctness`; replay operates on redacted inputs, so drift detection
ignores differences in redacted content.

**Neutral:** baseline files are plain JSON and inspectable; eval CLI exit codes
(0/1/2) follow the health command convention.

## References

- Issue #310 (EvalRunner), #311 (BaselineComparator), #308 (fixtures), #298 (eval CLI), #314 (ReplayEvaluator), #305 (redaction)
- ADR-014 (EvalResult in core types) — the contract EvalRunner feeds
- RAGAS — the four-metric framework the suite derives from
