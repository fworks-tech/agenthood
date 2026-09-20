# Spec: Fix Reviewer empty-tree RANGE on new-branch pushes

## Problem
On the first push from a new branch, `github.event.before` is the zero SHA. The reviewer workflow falls back to `git hash-object -t tree /dev/null` (the empty-tree SHA `4b825dc...`) as the diff base. `git diff <empty-tree>...HEAD` yields no files because the empty tree is not an ancestor of HEAD, so the Reviewer agent receives an empty file list, posts its standard "all trials passed" verdict, and the PR gets a green review with zero actual review.

## Proposed Solution
Resolve the diff base against the PR's actual base branch instead of the push event's `before` SHA:

1. Look up the PR for the current branch via `gh pr view --json baseRefName`.
2. Fetch the base branch ref (`origin/<baseRefName>`).
3. Compute `git merge-base origin/<baseRefName> HEAD` as the true base SHA.
4. Use `<merge-base>...HEAD` as the RANGE.
5. If the resolved file list is empty AND the PR reports changes (via `gh pr view --json changedFiles`), fail the job loudly with `::error::` — never post a passing verdict on an empty diff.

## Out of Scope
- Other workflows that use the same pattern (only `reviewer.yml` has this push-event shape).
- The `agent-analysis.sh` empty-file-list guard (it correctly skips; the fix is upstream in the workflow).
- Base-branch detection for PRs opened from forks (out of scope for this repo's CI).

## Acceptance Criteria
- [ ] First push from a new branch produces a RANGE anchored at the merge-base with `origin/main` (or the PR's actual base).
- [ ] The Reviewer agent receives the full file list on new-branch PRs.
- [ ] If the file list resolves empty for a PR that has changes, the job fails with a visible error.
- [ ] Existing behavior for subsequent pushes (non-zero `before` SHA) is unchanged.

## Testing Strategy
- Unit: none (workflow YAML, not unit-testable).
- Integration: open a scratch PR from a fresh branch, confirm the review job posts real findings, then delete the branch.
