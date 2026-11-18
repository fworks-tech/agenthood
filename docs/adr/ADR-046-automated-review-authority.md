# ADR-046: Automated Review Authority

**Date:** 2026-11-17
**Status:** Accepted
**Supersedes:** None

## Context

The Reviewer runs on every push through `.github/workflows/reviewer.yml`. Until
this decision it received at most five changed file names (`max-files: "5"`) and
a prompt that told the model it could not see contents (`include-diff: "false"`).
Its decision marker was the job gate: `blocking=true` failed the required
`review` check, and warnings above `warning-threshold` failed it too.

A language model reading names is not a gate. In PR #1082 the pass reviewed at
most five of the 39 changed files, and none of their contents. Run
`44209638155` on `3bb3ba0b` failed attempt 1 with `blocking=true warnings=3` at
00:41:54, then passed attempt 2 with `blocking=false warnings=0` at 00:44:54.
The same SHA, the same run, opposite outcomes. The `blocking=false warnings=3`
and `blocking=true warnings=3` pair that also appears on the PR is not the same
SHA: the first is `9e5845e6` (run `44207151420`), the second is `2ce920e8` (run
`44207545321`). The threshold was 3 and the gate only fails when warnings
exceed it, so `warnings=3` passed; the flip was the model's `blocking` flag.

The findings were unfalsifiable for the same reason. One blocking comment asked
`MIGRATION.md` for a rollback section that the file already had
(`MIGRATION.md:35`), because the model never read the file.

Two presentation defects made the history worse. The analysis comments carried
no reviewed SHA, and the previous comment was never marked outdated:
`stale-comment.sh` called `gh api --jq -r '.body'`, which `gh` rejects, and the
`|| return 0` swallowed the error. The Herald comment created at 00:23:46 was
edited at 00:45:08 to cite `3bb3ba0`, so its creation time looked earlier than
Reviewer comments it actually followed.

## Decision

1. **The model verdict is advisory.** The Reviewer posts `blocking` and
   `warnings` as severity language for humans, but the job does not fail on
   either. The shared action has a `gate-mode` input. `blocking` keeps the old
   behavior for agents that still gate on their output; `advisory` keeps the
   injection checks (conflicting, malformed or trailing decision markers) and
   returns success for any well-formed verdict. `reviewer.yml` sets
   `gate-mode: "advisory"`.
2. **Deterministic checks are the gate.** Lint, typecheck, build, tests, links,
   the skill contract, the lock check and The Sentinel decide whether a PR can
   merge. None of them calls a model.
3. **The model gets the diff, bounded.** The Reviewer receives up to 100 KB of
   `git diff`, wrapped as untrusted data. `package-lock.json`,
   `agenthood.lock`, `CHANGELOG.md` and `docs/release-notes.md` are excluded
   from the diff and the file list. The file list is capped at 100 names. The
   prompt reserves `blocking=true` for a defect the diff introduces and
   forbids claims the diff does not show.
4. **The comment states its coverage.** Every analysis comment carries the
   reviewed commit SHA, the changed-file count in scope, the diff size, a
   `capped at 100 KB` marker only when the byte cap fired, the number of
   files left out of the list, and the generated files the exclusions
   removed from the range when any appeared in it. A visible verdict line is
   derived from the decision marker, so the comment and the marker cannot
   disagree.
5. **Determinism is proved by two dispatches.** `reviewer.yml` accepts
   `workflow_dispatch`. Two runs on one SHA must both pass the `review` check.
   The comments may differ because the model is advisory; the gate verdict may
   not.
6. **A skipped review is announced.** When the prerequisites are missing (no
   pull request context, no `OPENCODE_API_KEY`), the job still exits 0, but
   the absence is posted to the PR thread with the reason when a PR exists,
   and written to the run summary when it does not (there is no thread to
   comment on). A comment was chosen over a skipped step because the thread
   is the record people read; the summary covers the dispatch case.
7. **A posting failure never fails an advisory job.** Comment bodies are
   capped in bytes below the 65,536 character API ceiling with a truncation
   note, and a failed post is a warning in advisory mode. A blocking agent
   still fails closed, because its comment is the gate's evidence.
8. **No agent gates on a model verdict.** The inventory after this decision:

   | Agent | Step | Model | Gate | Threshold |
   |---|---|---|---|---|
   | the-reviewer | `reviewer.yml:80` | `opencode/gpt-5-nano` (`reviewer.yml:99`) | advisory (`reviewer.yml:100`) | n/a |
   | the-sentinel | `pr.yml:196` | `opencode/qwen3.8-flash` (`pr.yml:207`) | advisory, changed here | default 2, out of the gate path |
   | the-auditor | `pr.yml:94` | `opencode/qwen3.8-flash` (`pr.yml:107`) | disabled (`pr.yml:96`) | default 2 if re-enabled |
   | the-warden | `pr.yml:138` | `opencode/qwen3.8-flash` (`pr.yml:151`) | disabled (`pr.yml:140`) | default 2 if re-enabled |

   The sentinel carried the same flip shape #1082 exposed: a flash-class
   model, the default threshold of 2 (`action.yml:40`, `decision-gate.sh:97`)
   and a blocking gate, so its analysis moves to advisory mode. Its
   deterministic structure check (`sentinel-check.sh`) stays the gate. The
   disabled auditor and warden steps inherit advisory semantics only if
   someone re-enables them without setting `gate-mode`, which this table
   records.

## Consequences

- A blocking-looking Reviewer comment no longer stops a merge by itself. The
  required checks that stop a merge are the deterministic ones. A reviewer who
  wants a finding enforced turns it into a failing test, a lint rule or a link
  check.
- The Reviewer costs the same one model call per push as before. The input grows
  from at most five file names (hundreds of bytes) to at most 100 KB of diff
  (about 25k tokens at four bytes per token). The byte cap is the cost bound.
  The two dispatch runs are proof, not part of the normal flow.
- A missing verdict or a CLI failure is a warning in advisory mode. The comment
  names the failure and the deterministic checks remain the gate. A blocking
  agent still fails closed because its verdict is the gate.
- The gate cannot flip on a rerun. A future change that puts the model back in
  the gate path must explain how it keeps this property.
- Advisory mode is covered end to end by tests. `decision-gate.test.sh` proves
  that a blocking marker, over-threshold warnings and conflicting markers still
  fail closed in `blocking` mode and are ignored in `advisory` mode, that an
  oversized comment body is capped with a truncation note, and that the diff
  stream binds on the 100 KB byte cap with its marker.
  `reviewer-workflow.test.ts` proves that the workflow passes `advisory`, that
  the action maps it to `AGENTHOOD_GATE_MODE`, that the script reads that
  variable, and that the diff payload stays bounded. Those TS assertions are
  wiring checks on literal strings, not a behavioral contract; the test file
  says so.
- A skip notice posts once per skipped run. A later real analysis marks it
  outdated through the shared heading; consecutive skips (a repo with no
  `OPENCODE_API_KEY` commenting on an open PR) accumulate one entry per push.
  Accepted: the case means misconfiguration and each entry names it.
- The posting-failure branch (API error, rate limit) is guarded in the script
  but has no live run exercising it; the cap and the skip path are covered by
  tests and the F1 dispatch proof.
- The analysis comment uses one H2 title, demotes the report's H1/H2 headings
  below it, and marks the previous comment outdated. The Reviewer workflow needs
  `issues: write` for that edit.

## References

- PR #1082: the adoption PR where the flip was observed. PR #1086 closes the
  edges this ADR left open: skip visibility, the comment cap and the
  blocking-mode inventory.
- Runs `44207151420`, `44207545321`, `44209272806` and `44209638155` on PR
  #1082. Attempt 1 and attempt 2 of `44209638155` are the same-SHA flip.
- Proof runs on `348f63c1`, both success and both `no blocking findings,
  3 warnings`:
  [44215065350](https://github.com/fworks-tech/agenthood/actions/runs/44215065350)
  and
  [44215545410](https://github.com/fworks-tech/agenthood/actions/runs/44215545410).
- [ADR-028](ADR-028-skill-frontmatter-contract.md): the skill contract the
  Reviewer's own SKILL.md follows.
- [ADR-041](ADR-041-member-tool-permission-model.md): the tool boundary the
  deterministic checks enforce.
- `.github/workflows/reviewer.yml`, `.github/scripts/agent-analysis.sh`,
  `.github/scripts/decision-gate.sh`, `.github/scripts/stale-comment.sh`
