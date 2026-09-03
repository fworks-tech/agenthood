# Connector: Sentry

## What it provides
Read error events, exceptions, and performance issues from Sentry.
The Debugger uses this to correlate production errors with commits and PRs.
The Auditor uses this to identify recurring security-relevant errors.
The Herald checks error rate after a release before announcing it as stable.

Primary path is the hosted Sentry MCP over OpenCode remote MCP with OAuth —
no tokens in config, no local server process.

## Available Tools (hosted MCP)

| Tool | Description | Members |
|------|-------------|---------|
| `find_organizations` | List Sentry organizations the user can access | Debugger, Auditor, Herald |
| `find_projects` | List projects within an organization | Debugger, Auditor |
| `search_issues` | Search issues by query, time range, impact; sort by impact | Debugger, Auditor |
| `get_issue_details` | Read a specific issue with full stack trace and events | Debugger |
| `begin_seer_issue_fix` | Escalate a systemic issue to Seer for root-cause fix planning | Debugger |

## Primary Members
- **The Debugger** — reads error events to diagnose production issues
- **The Auditor** — looks for security-relevant errors (auth failures, injection attempts)
- **The Herald** — checks error rate after a release before announcing it as stable

## Setup (OpenCode, hosted — primary)

```json
{
  "mcp": {
    "sentry": {
      "type": "remote",
      "url": "https://mcp.sentry.dev/mcp",
      "oauth": {}
    }
  }
}
```

Authenticate, then verify:

```bash
opencode mcp auth sentry
```

```text
What organizations do I have access to in Sentry?
```

Scoped variant (single org/project):

```json
{
  "mcp": {
    "sentry": {
      "type": "remote",
      "url": "https://mcp.sentry.dev/mcp/{org}/{project}",
      "oauth": {}
    }
  }
}
```

## Natural-language examples

```text
Show me Sentry issues affecting more than 10 users, from the last week, sorted by impact.
```

```text
Show me new Sentry issues that appeared after yesterday's deployment.
```

```text
Get the full details and stack trace for Sentry issue <issue-id>.
```

## Release-tag correlation

- The Debugger correlates Sentry errors with git commits using the `release` tag
- Tag releases in Sentry with the same version as git tags (`sentry-cli releases new <version>`)
- After a deploy, search issues filtered by the release tag before declaring the release stable

## Seer escalation criteria

- Escalate via `begin_seer_issue_fix` only when the issue is systemic:
  recurring across releases, or root cause still unclear after Step 4 of the
  Debugger five-step protocol
- Targeted single-issue fixes stay in-protocol — no Seer
- Record the Seer plan link in the PR description

## Auth and timeout remedies

- `401 / expired token` — re-run `opencode mcp auth sentry`, then retry the verify prompt
- `OAuth consent denied` — approve the Sentry OAuth consent screen for the correct organization
- `Request timed out` — retry once, then narrow `search_issues` (shorter range, one project)
- `No organizations found` — confirm the OAuth identity belongs to the Sentry org (wrong account is the common cause)

## Fallback (legacy npx stdio)

Use only when the hosted endpoint is unreachable:

```json
{
  "mcp": {
    "servers": {
      "sentry": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-sentry"],
        "env": {
          "SENTRY_AUTH_TOKEN": "${SENTRY_AUTH_TOKEN}",
          "SENTRY_ORG": "${SENTRY_ORG}"
        }
      }
    }
  }
}
```

- Requires a Sentry auth token with `project:read` scope
