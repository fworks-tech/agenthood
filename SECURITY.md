# Security Policy

The Agenthood Society takes the security of its members, adopters, and the
packages it publishes seriously.

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest (semantic-release from `main`) | ✅ |
| older releases | ❌ — upgrade to the latest |

## Reporting a Vulnerability

Do **not** open a public issue for a vulnerability. Report privately:

- **GitHub:** use the repository's [private vulnerability reporting](https://github.com/fworks-tech/agenthood/security/advisories/new) flow
- **Email:** `inbox@flabs.tech` — include the affected version, a minimal
  reproduction, and your suggested fix if you have one

You will receive an acknowledgement within 48 hours and a status update within
5 business days. If the report is confirmed, a fix ships in the next release
and a security advisory is published.

## What the Society does

- **Secrets:** never commit keys or tokens; `.env` files are blocked by the
  pre-commit hook, and CI runs secret scanning (Gitleaks) on every PR
- **Dependencies:** lockfiles are committed (`npm ci` in CI); the Auditor gate
  fails on high/critical findings outside npm's own bundled dependencies
- **Supply chain:** GitHub Actions are pinned to full commit SHAs; the VS Code
  extension publishes with the lockfile-pinned `@vscode/vsce`
- **LLM agent analysis:** CI agent outputs are filtered for secrets before
  posting, and verdicts are parsed from a structured trailing block

## Security-relevant files

- `.githooks/pre-commit` — secret scanning + main-branch protection
- `.github/workflows/pr.yml` — Auditor (Gitleaks + `npm audit`) gates
- `.github/scripts/` — shared analysis and decision-gate scripts
