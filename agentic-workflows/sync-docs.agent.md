---
description: After every merge to main, checks whether the merged changes affect documented APIs, workflows, or READMEs, and opens a follow-up PR if documentation is stale.
on:
  push:
    branches: [main]
permissions: read-all
safe-outputs:
  - create-branch
  - create-pr
  - add-comment
---

# Sync Documentation After Merge

When a change merges to main, check whether it affects documented behavior
and open a documentation PR if updates are needed.

## Steps

1. **Read the merge commit** — identify which files changed

2. **Check for documentation impact** in these categories:

   | Changed area | Documentation to check |
   |-------------|----------------------|
   | API routes / endpoints | `docs/api/`, README API section |
   | Environment variables | README setup section, `.env.example` |
   | CLI commands or scripts | README usage section |
   | Data models / schemas | API docs, ADRs |
   | Configuration files | README configuration section |
   | Dependencies added/removed | README prerequisites |
   | Architectural patterns changed | `docs/adr/` |

3. **For each affected doc**, determine if it is stale:
   - Does the doc describe behavior that no longer exists?
   - Does the doc reference files, functions, or commands that have changed?
   - Are there new behaviors that have no documentation?

4. **If no documentation is stale:** post a brief comment on the merged PR confirming docs are current

5. **If documentation is stale:**
   - Create a new branch: `docs/sync-after-#{PR-number}`
   - Update the stale documentation to reflect the current code
   - Open a PR with:
     - Title: `docs(sync): update documentation after #{original PR title}`
     - Body: lists which docs were updated and what changed
     - Links to the original PR: `Follow-up to #{N}`

## PR Body Template

```markdown
## Documentation Sync

Follow-up to #{N} — {original PR title}

### What changed

{Bullet list of documentation updates made}

### Why

The following docs were stale after the code change merged:
{list of files and what was outdated}

### Verification

- [ ] All commands in updated docs were tested and work
- [ ] API docs match current endpoint signatures
- [ ] README setup section reflects current dependencies

*— The Librarian, Agenthood*
```

## Notes
- Only opens a PR if documentation is actually stale — not on every merge
- Does not modify source code — documentation files only
- If unsure whether a doc is stale, posts a question on the original PR instead of guessing
