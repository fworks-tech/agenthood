# Spec: Automated Skill Description Optimization

## Problem
Writing skill descriptions that trigger reliably is the hardest part of skill authoring. The difference between 20% and 80% trigger rate is description quality — but there is no automated way to measure or improve it. Authors guess, deploy, and discover failures in production.

## Proposed Solution
Add `agenthood optimize <member>` command that closes the loop:

1. **Measure** — score the current description against a trigger query set (should-trigger / should-not-trigger) using the semantic predictor (embedding cosine similarity).
2. **Generate** — ask an LLM to produce N description variants tuned to the trigger set, constrained by the member's actual purpose.
3. **Score** — run each variant through the same predictor; rank by F1.
4. **Validate** — hold out a validation split to guard against over-fitting.
5. **Converge** — iterate generate/score until F1 plateaus or a threshold is met.
6. **Report** — print before/after metrics, the winning description, and write it back to `member-specs.ts` on `--apply`.

## Out of Scope
- Modifying the SKILL.md body (only the short `description` field is optimized).
- Optimizing for the keyword surface (that surface is deterministic; description changes do not affect it).
- Multi-member joint optimization (one member per run).
- Regression tracking of description changes over time (future: store description hash in run history).

## Acceptance Criteria
- [ ] `agenthood optimize <member>` runs and prints before/after trigger rates.
- [ ] Requires `--triggers <path>` (reuses existing trigger set format).
- [ ] Generates at least 3 description variants per iteration.
- [ ] Scores variants using the semantic predictor (embedding cosine similarity).
- [ ] Uses train/validation split to detect over-fitting.
- [ ] Stops after N iterations (default 3) or when F1 improvement < 0.02.
- [ ] `--apply` writes the winning description to `member-specs.ts`.
- [ ] `--json` outputs machine-readable results.
- [ ] Without `--apply`, prints the winning description but does not modify files.

## Testing Strategy
- Unit tests for the optimization loop (mock LLM, mock predictor).
- Unit tests for description variant generation prompt.
- Integration test: run `optimize` against a fixture trigger set with a stub LLM.
- Coverage target: 80% of new code.

## Open Questions
- Should the command also update the SKILL.md frontmatter description? (Defer: start with member-specs.ts only.)
- Should we persist optimization history? (Defer: future enhancement.)
