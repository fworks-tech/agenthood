---
name: sentry
description: Monitor and debug application errors via the Sentry CLI. Use when triaging production errors or managing releases.
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

# sentry-cli

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
