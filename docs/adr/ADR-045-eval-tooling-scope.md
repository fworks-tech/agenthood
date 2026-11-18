# ADR-045: Evaluation Tooling Scope

**Date:** 2026-11-17
**Status:** Accepted
**Supersedes:** None

## Context

`agenthood eval` and `agenthood optimize` grew out of six specs that were deleted
in commit `82dee90e` (the orphan-doc triage of the 4.1 cleanup). The features
shipped, but the boundary that made them small never reached an ADR. The specs
were the only place that recorded which evaluation ideas were deliberately left
out, and a future contributor reading the code sees the features without the
reasons they stopped there.

The tooling lives in three layers:

| Layer | Files |
|---|---|
| Runner and scoring | `src/evals/EvalRunner.ts`, `EvalJudge.ts`, `AssertionJudge.ts`, `BaselineComparator.ts`, `benchmark.ts`, `evalSuiteSchema.ts` |
| Comparison and history | `src/evals/abComparison.ts`, `BlindJudge.ts`, `runHistory.ts`, `convergence.ts`, `ReplayEvaluator.ts`, `descriptionOptimizer.ts` |
| Commands | `src/commands/eval.ts`, `evalArgs.ts`, `evalCompare.ts`, `evalReplay.ts`, `evalReport.ts`, `evalTriggers.ts`, `optimize.ts` |

Two adjacent specs were deleted in the same commit. Output format validation is a
runtime boundary (`src/runtime/outputFormat.ts`), and Docker sandboxing is a skill
script boundary (`src/skills/execution/sandbox.ts`, already decided in ADR-036).
They are recorded here only where their YAGNI boundary would otherwise be lost.
The sixth deleted spec, `815-review-empty-tree-range`, described a review bug, not
a tooling decision, and is not part of this ADR.

## Decision

### 1. One eval pipeline, one judge

A suite run is: load the suite, run the member, grade deterministic assertions,
ask one LLM judge for the remaining metrics, compare to the baseline, print the
report. The default metrics are faithfulness, relevance, context recall and
answer correctness; the first three are LLM-scored and the last uses embeddings.
Assertions cover exact, contains, regex and semantic matches. A custom judge is a
constructor argument, not a new command.

### 2. Baseline, history and convergence are separate records

The baseline is the comparison target for the next run and is overwritten only
with `--update-baseline`. History is append-only JSONL per member in
`.agenthood/evals/history/`, and convergence is a pure function over the last
window of that history. Regression detection compares the current run with the
best-seen run for the same member and suite. Neither record mutates the other.

### 3. A/B comparison is a mode of eval

`agenthood eval <a> --ab <b> --suite <path>` runs both members, scores each task
blind (each output is judged in isolation), aggregates per metric, runs a paired
t-test and Cohen's d, and prints a winner. Exit code 1 means B won, which is
enough for CI. There is no second A/B framework and no stored A/B history.

### 4. Description optimization is a separate command

`agenthood optimize <member> --triggers <path>` mutates candidate descriptions
against a trigger query set, iterates a bounded number of times, and writes only
with `--apply`. It does not touch the SKILL.md body and does not optimize the
keyword surface, which is deterministic.

### 5. Output format and sandbox stay at their own boundaries

`output_format` is member frontmatter validated in `MemberRunner`, lenient by
default and strict on request. It is not an eval metric. Docker isolation belongs
to skill script execution (ADR-036), not to the eval command. Keeping these out of
`src/evals/` is what keeps the evaluation surface one pipeline instead of three.

## Out of Scope (YAGNI)

Each item was considered and deliberately left out. The reason is the part the
deleted specs carried.

| Item | Why it stays out |
|---|---|
| Multiple judges in one run | One judge is enough to compare runs; mixing judges makes a score change unattributable. |
| Dashboards or visualization | The CLI table and `--json` cover the decision; a UI would be a second product. |
| Automatic CI gating on A/B results | The exit code is the gate; a workflow policy belongs to CI, not to the eval command. |
| Cross-suite A/B comparison | One suite per run keeps the unit of comparison stable. |
| Stored history for A/B results | A/B is a decision, not a time series; the eval history already stores the inputs. |
| Per-metric significance testing | The overall paired test answers "is B better"; per-metric tests multiply false positives. |
| Automatic iteration stopping on convergence | Convergence is reported, not enforced; the caller decides when to stop. |
| Cross-suite convergence | Convergence is only meaningful per member and suite. |
| History pruning or TTL | History is append-only by design; a retention policy is an operational decision with no consumer yet. |
| Embedding-based A/B comparison | Output-to-output judging is the current need; an embedding comparison is a separate method with its own calibration. |
| Editing the SKILL.md body during optimization | Only the `description` field is optimized; the body is the protocol and needs review. |
| Keyword-surface optimization | That surface is deterministic and already scored by trigger rate. |
| Multi-member joint optimization | One member per run keeps the result attributable. |
| Tracking description changes over time | A future run-history field can carry the description hash; no consumer needs it now. |
| JSON Schema validation of output | The regex covers the current need; schema validation is a larger dependency and a separate mode. |
| Template-based output validation | The regex plus tests cover the stated cases; a template engine is new syntax to maintain. |
| Frontmatter changes to third-party skills | The parser path for external skills stays untouched; `output_format` is opt-in. |
| Breaking existing runs by default | `lenient` is the default so a format warning never turns a working run into a failure. |
| Windows Docker Desktop specifics | The sandbox targets Linux and macOS containers; Windows behavior is the daemon's concern. |
| Container image registry management | The default image or a configured image is enough; a registry client is another surface. |
| Multi-container orchestration | One container per tool call is the isolation model; orchestration is a different product. |

## Consequences

- A new metric or judge is added in `EvalJudge` and its tests, not in a new
  command. A new history field is added to `EvalRunRecord` and `runHistory`, with
  the convergence tests as the contract.
- A/B changes are checked by `tests/unit/evals/abComparison.test.ts` and
  `BlindJudge.test.ts`; history and convergence by their own unit tests.
- Output format changes are checked by `src/runtime/outputFormat.ts` tests and
  the `MemberRunner` tests. Sandbox changes are checked by the skill execution
  tests and must keep ADR-036's fail-closed rule.
- The absent dashboard, auto-stop and multi-judge modes are decisions, not
  missing work. Retaking any of them starts with a new ADR that names the
  consumer, not with a patch to `src/evals/`.
- The eval command remains a local CLI. It is not a service, a scheduler or a
  hosted comparison product.

## References

- Commit `82dee90e`: origin of the deletion. Recover a spec with
  `git show 82dee90e^:docs/specs/<name>.md`.
- Deleted specs: `558-blind-ab-comparison`, `562-skill-regression-testing`,
  `584-description-optimization`, `594-output-format-validation`,
  `884-sandbox-docker-isolation`.
- [ADR-014](ADR-014-evalresult-in-core-types.md): the shared `EvalResult` shape
- [ADR-016](ADR-016-llm-judge-evaluation-pipeline.md): the judge pipeline
- [ADR-036](ADR-036-skill-script-execution-and-sandboxing.md): the sandbox decision
- `src/evals/`, `src/commands/eval.ts`, `src/commands/optimize.ts`
- `tests/unit/evals/`, `tests/unit/runtime/outputFormat.test.ts`
