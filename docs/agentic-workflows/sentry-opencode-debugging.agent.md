---
description: Triage a Sentry production error via hosted OpenCode MCP — verify access, search by impact, read details, apply a targeted fix, escalate systemic issues to Seer, leave a regression test.
type: manual-template
usage: Copy the steps below into an OpenCode session with the Sentry hosted MCP configured. Paste the Sentry issue link or error description as context, then ask The Debugger to follow the flow.
on:
  workflow_dispatch: {}
permissions:
  issues: read
  pull-requests: write
safe-outputs:
  - add-comment
---

# Sentry OpenCode Debugging

Triage a production error from Sentry using the hosted MCP
(`https://mcp.sentry.dev/mcp` via OAuth) and The Debugger's five-step protocol.
Portal setup: `docs/portals/sentry.md`.

## Steps

1. **Verify access** — ask `What organizations do I have access to in Sentry?`
   - If auth fails, re-run `opencode mcp auth sentry` and retry once

2. **Search by impact** — `search_issues` filtered by time range, sorted by impact
   - Prefer issues affecting the most users first
   - Example: issues from the last week affecting more than 10 users

3. **Read details** — `get_issue_details` for the full stack trace, events, release tag
   - Correlate the `release` tag with `git log` for that tag
   - State the exact error, file, and line before moving on

4. **Targeted fix** — apply the five-step protocol (reproduce → hypothesize → test → fix at root cause)

5. **Systemic? escalate to Seer** — check the escalation criteria in
   `docs/portals/sentry.md` ("Seer escalation criteria"); if met, run
   `begin_seer_issue_fix` and record the plan link in a comment

6. **Regression test** — write a test that fails on unfixed code and passes on fixed code;
   document the root cause in the PR description

## Notes

- Scoped to issue reads + comment writes; sibling templates still use `read-all`
  (migrate them separately if the Society adopts least-privilege frontmatter)
- Does not modify the `src/portals/` runtime — MCP tools only
- If the hosted endpoint is unreachable, fall back to the legacy npx stdio config in `docs/portals/sentry.md`
- Flags security-relevant errors (auth failures, injection attempts) for The Auditor
