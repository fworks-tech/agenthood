---
name: the-watchman
schedule: "0 */2 * * *"
priority: BACKGROUND
member: the-doorman
description: Every 2 hours, checks for uncommitted changes sitting idle and branches drifting from main.
---

# Ritual: The Watchman

## Trigger
Every 2 hours, around the clock.

## What It Does
A lightweight pulse check. Looks for work that has been started but not committed, and branches that are drifting far from main. Surfaces findings quietly — does not interrupt unless thresholds are exceeded.

## Steps

1. Run `git status` — identify uncommitted changes
2. Check timestamp of last modification for each dirty file
3. Flag any dirty file last touched > 2 hours ago
4. Run `git log main..<branch> --oneline` for each active branch
5. Flag branches more than 20 commits behind main
6. Post alert only if findings exceed thresholds

## Alert Format

```markdown
## 👁️ Watchman Alert — {Time}

### ⏰ Idle Uncommitted Changes
{file — last modified N hours ago}

*The Society suggests: commit your work or stash it.*

### 📉 Branches Drifting from Main
{branch — N commits behind main}

*The Society suggests: rebase soon to avoid painful conflicts.*

---
*The Watchman sees all · Agenthood*
```

## Notes
- Runs silently when nothing exceeds thresholds
- Uncommitted threshold: 2 hours (configurable)
- Branch drift threshold: 20 commits behind main (configurable)
- Low priority — never interrupts USER or SCHEDULED work
