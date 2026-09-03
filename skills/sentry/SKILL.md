---
name: sentry
description: Monitor and debug application errors via Sentry MCP and CLI. Use when triaging production errors or managing releases.
metadata:
  category: monitoring
  dependencies:
    cli: sentry-cli
    checkCommand: sentry-cli --version
    install:
      darwin: { brew: getsentry/tools/sentry-cli }
      linux: { script: "curl -sL https://sentry.io/get-cli/ | bash" }
      windows: { scoop: sentry-cli }
  config:
    - name: SENTRY_AUTH_TOKEN
      label: Auth Token
      type: secret
      required: true
    - name: SENTRY_ORG
      label: Organization
      type: string
      required: true
  auth:
    type: api-key
---

# sentry

Use the hosted Sentry MCP in OpenCode for triage; use `sentry-cli` for releases and source maps.

## MCP use (primary)

Hosted endpoint `https://mcp.sentry.dev/mcp` via OAuth — see `docs/portals/sentry.md` for setup.

- Find orgs/projects: `find_organizations`, `find_projects`
- Triage: `search_issues` (filter by impact, time range; sort by impact), then `get_issue_details` for the full stack trace
- Correlate the issue `release` tag with `git log` before forming a hypothesis
- Verify access with: `What organizations do I have access to in Sentry?`

## Seer escalation

- Escalation criteria live in `docs/portals/sentry.md` ("Seer escalation criteria")
- Record the Seer plan link in the PR description

## CLI use (releases, source maps)

Use `sentry-cli` for Sentry error monitoring.

## Common Commands

### Issues
- List issues: `sentry-cli issues list --org <org>`
- Resolve issue: `sentry-cli issues resolve <id>`
- Ignore issue: `sentry-cli issues ignore <id>`

### Releases
- Create release: `sentry-cli releases new <version>`
- Finalize release: `sentry-cli releases finalize <version>`
- List releases: `sentry-cli releases list`

### Source Maps
- Upload: `sentry-cli sourcemaps upload ./dist`

## Notes
- Auth token from https://sentry.io/settings/account/api/auth-tokens/
- Set `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` env vars
