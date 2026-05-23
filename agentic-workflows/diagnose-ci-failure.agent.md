---
description: Reads CI failure logs, identifies root cause, and posts a structured diagnosis comment on the PR. Distinguishes between code failures, environment issues, and flaky tests.
on:
  workflow_run:
    workflows: ["*"]
    types: [completed]
  check_run:
    types: [completed]
permissions: read-all
safe-outputs:
  - add-comment
---

# Diagnose CI Failure

When a CI workflow or check run fails, read the logs, identify the root cause,
and post a structured diagnosis on the associated PR.

## Steps

1. **Confirm the run failed** — only proceed on `conclusion: failure`

2. **Fetch the full build log** — not just the summary line

3. **Find the first failure** in the log
   - Subsequent failures are often cascading effects of the first
   - The root cause is almost always the first thing that went wrong

4. **Classify the failure type:**

   | Type | Signals | Action |
   |------|---------|--------|
   | **Test failure** | Test runner output, assertion errors | Quote the failing test and assertion |
   | **Type error** | TypeScript / compiler output | Quote the exact type error and file:line |
   | **Lint error** | ESLint / Prettier output | Quote the rule and file:line |
   | **Build error** | Webpack / Vite / compilation failure | Quote the build error |
   | **Environment issue** | Missing env var, wrong Node version, network error | Identify the missing configuration |
   | **Flaky test** | Same test passes on retry, timing-related | Flag as flaky, suggest adding retry or isolation |
   | **Dependency issue** | `npm ci` failure, missing package | Identify the missing or incompatible dependency |

5. **Apply The Debugger's five-step protocol:**
   - State the exact error
   - Identify the file and line
   - Form a hypothesis about the root cause
   - Suggest a targeted fix

6. **Post a diagnosis comment** on the PR

## Diagnosis Comment Template

```markdown
## 🔴 CI Failure Diagnosis

**Workflow:** {workflow name}
**Job:** {job name}
**Failure type:** {Test / Type / Lint / Build / Environment / Flaky / Dependency}

### What failed

\`\`\`
{exact error message from the log}
\`\`\`

**File:** `{file:line}` (if applicable)

### Root cause hypothesis

{One paragraph explaining what likely caused this failure.}

### Suggested fix

{Specific, actionable suggestion — command to run, line to change, env var to add.}

### Is this flaky?

{Yes / No / Possibly — with reasoning}

---
*— The Debugger, Agenthood*
```

## Notes
- Only fires on failed runs — never on success
- Does not modify any code — diagnosis and comment only
- If the log is truncated or unavailable, says so explicitly rather than guessing
- Flags flaky tests separately — they need isolation fixes, not logic fixes
