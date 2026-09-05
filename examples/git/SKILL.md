---
name: git
description: Use when performing git operations — branching, rebasing, stashing, bisecting, resolving merge conflicts, or recovering lost commits. Covers advanced git workflows beyond basic add/commit/push.
license: MIT
---

# Git

## Overview

Git is the Society's version control specialist. It handles complex git operations that go beyond basic add-commit-push, including interactive rebase, bisect debugging, stash management, and conflict resolution. Git operates on the principle that every commit is a recoverable state and every branch is a disposable experiment.

## When to Use

- When resolving merge conflicts that cannot be auto-resolved
- When using `git bisect` to find which commit introduced a bug
- When performing interactive rebase to clean up commit history
- When recovering lost commits or stashes
- When managing complex branch workflows (rebase vs merge decisions)
- When using `git worktree` for parallel development

## Process

### Interactive Rebase

1. Identify the range: `git log --oneline <base>..HEAD`
2. Plan the rebase: `git rebase -i <base>`
3. Squash fixups, reorder logically, rewrite messages
4. If conflicts arise: `git rebase --abort` to recover, fix, then `git rebase --continue`
5. Force-push only after confirming the rebase is complete

### Bisect Debugging

1. Start: `git bisect start`
2. Mark bad: `git bisect bad HEAD`
3. Mark good: `git bisect good <known-good-commit>`
4. Test at each step, then `git bisect good` or `git bisect bad`
5. Automate: `git bisect run <test-command>`
6. Reset: `git bisect reset`

### Stash Management

1. Stash with message: `git stash push -m "description"`
2. List: `git stash list`
3. Apply without removing: `git stash apply stash@{0}`
4. Apply and remove: `git stash pop stash@{0}`
5. Diff a stash: `git stash show -p stash@{0}`
6. Drop: `git stash drop stash@{0}`

### Conflict Resolution

1. Identify conflicted files: `git diff --name-only --diff-filter=U`
2. Open each file and resolve markers (`<<<<<<<`, `=======`, `>>>>>>>`)
3. Stage resolved files: `git add <file>`
4. Continue: `git rebase --continue` or `git merge --continue`
5. Verify: `git diff --check` (no remaining conflict markers)

## Red Flags

- Force-pushing to shared branches without team coordination
- Using `git reset --hard` on commits that have been pushed
- Rebasing commits that others have based work on
- Skipping `git diff --check` after resolving conflicts
- Using `git add .` during conflict resolution (stage files individually)

## Rationalizations

| What you think | What Git knows |
|----------------|---------------|
| "I'll just force-push, it's my branch" | Others may have based work on those commits. Force-push rewrites history they depend on. |
| "Rebase is too complicated" | Merge commits are equally complex when things go wrong. Understand both, choose deliberately. |
| "I'll resolve conflicts later" | Later means merge hell. Resolve conflicts as soon as they appear, while context is fresh. |
| "Stashes are just temporary" | Stashes accumulate and get forgotten. Name them, apply them, drop them. |

## Verification

Before confirming the operation is done:

- [ ] `git status` shows clean working tree (or expected state)
- [ ] `git log --oneline` shows expected commit history
- [ ] `git diff --check` confirms no conflict markers remain
- [ ] No force-push was performed without explicit confirmation
- [ ] Branch state is as expected (correct branch, correct commits)
