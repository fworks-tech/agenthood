---
description: Reviews pull requests using The Reviewer's five-axis framework — correctness, readability, architecture, security, and performance. Posts findings as structured review comments.
type: manual-template
usage: Copy the steps below into a Claude Code (or compatible) session when reviewing a PR. Paste the PR URL or diff as context, then ask The Reviewer to apply its five-axis framework.
on:
  pull_request:
    types: [opened, ready_for_review]
permissions: read-all
safe-outputs:
  - add-review-comment
  - request-changes
  - approve
---

# Review Pull Request

When a PR is opened or marked ready for review, conduct a five-axis review
using The Reviewer's methodology and post structured findings.

## Steps

1. **Read the PR description** — understand the intent, the issue it closes, and the test plan

2. **Check PR size**
   - Over 1000 lines changed → post comment asking author to split the PR before review proceeds
   - 300–1000 lines → note the size and proceed with extra care

3. **Read the tests first** — before the implementation
   - Do tests exist for the changed behavior?
   - Do they test behavior, not implementation details?
   - Are edge cases covered?

4. **Run the five-axis review** on each changed file:
   - Correctness — does it do what it claims?
   - Readability — can it be understood without help?
   - Architecture — does it fit the system?
   - Security — are there any vulnerabilities? (Always check, even for UI-only changes)
   - Performance — any N+1, unbounded loops, or unnecessary work?

5. **Categorize every finding** with a label:
   - `[blocking]` — must fix before merge
   - `[suggestion]` — worth considering, not required
   - `[question]` — seeking clarification
   - `[nit]` — minor style note, may ignore
   - `[praise]` — something done notably well

6. **Post findings** as inline review comments on the relevant lines

7. **Post a summary comment** with:
   - Overall assessment (approve / request changes)
   - Count of blocking vs suggestion findings
   - Any patterns worth addressing holistically

8. **Submit review action:**
   - Zero `[blocking]` findings → Approve
   - One or more `[blocking]` findings → Request Changes

## Summary Comment Template

```markdown
## Review by The Reviewer

**Verdict:** {Approve / Request Changes}

| Category | Findings |
|----------|---------|
| [blocking] | {N} |
| [suggestion] | {N} |
| [question] | {N} |
| [nit] | {N} |
| [praise] | {N} |

{One paragraph summary of the overall quality and main themes.}

*— The Reviewer, Agenthood*
```

## Notes
- Runs only on PRs marked `ready_for_review` — skips drafts
- Never approves a PR with `[blocking]` findings
- Posts at most one summary comment per review pass to avoid noise
