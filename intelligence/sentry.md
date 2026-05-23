# Connector: Sentry

## What it provides
Read error events, exceptions, and performance issues from Sentry.
The Debugger uses this to correlate production errors with commits and PRs.
The Auditor uses this to identify recurring security-relevant errors.

## Available Tools

| Tool | Description | Members |
|------|-------------|---------|
| `sentry.issues.list` | List recent unresolved issues | Debugger, Auditor |
| `sentry.issues.get` | Read a specific issue with full stack trace | Debugger |
| `sentry.events.list` | List recent error events | Debugger |
| `sentry.releases.list` | List releases and their error rates | Herald, Debugger |
| `sentry.releases.get` | Get error rate for a specific release | Herald |

## Primary Members
- **The Debugger** — reads error events to diagnose production issues
- **The Auditor** — looks for security-relevant errors (auth failures, injection attempts)
- **The Herald** — checks error rate after a release before announcing it as stable

## Setup

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

## Notes
- Requires a Sentry auth token with `project:read` scope
- The Debugger correlates Sentry errors with git commits using the `release` tag
- Tag your releases in Sentry with the same version as your git tags for best results
