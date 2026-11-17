# Security Policy

The Agenthood Society takes the security of its members, adopters, and the
packages it publishes seriously.

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest (semantic-release from `main`) | ✅ |
| older releases | ❌: upgrade to the latest |

## Reporting a Vulnerability

Do **not** open a public issue for a vulnerability. Report privately:

- **GitHub:** use the repository's [private vulnerability reporting](https://github.com/fworks-tech/agenthood/security/advisories/new) flow
- **Email:** `inbox@flabs.tech`: include the affected version, a minimal
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

## Accepted residual risks

`.github/scripts/audit-filter.mjs` carries a dated `ADVISORY_ALLOWLIST` for advisories with no
upstream fix. The gate fails closed: an entry covers only the advisory, packages and scope it names,
and it stops working after its expiry date.

| Advisory | Package | Scope | Why it is acceptable | Expires |
|----------|---------|-------|----------------------|---------|
| [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) | `picomatch` | dev only, through `vite`, `vitest`, `@vitest/coverage-v8`, `tinyglobby`/`fdir`, `micromatch` and `@typescript-eslint/typescript-estree` | the advisory (ReDoS) affects every published release (`4.0.7` is the latest), and `npm audit --omit=dev` reports zero findings: the CLI that ships never loads `picomatch` at runtime | 2027-02-01 |

An active entry shows up in CI as a `::warning::` annotation naming the advisory and the reason. The
production pass (`--omit=dev`) accepts no exception at any severity. When the entry expires the
Auditor fails until the dependency is upgraded or the entry is renewed with a new decision, recorded
in [ADR-043](docs/adr/ADR-043-dependency-audit-exception-policy.md).

## Self-audit

The Society audits itself with the same gates it enforces on adopters:

- **Contract:** `npx agenthood verify`: frontmatter shape, name↔directory match
- **Integrity:** `agenthood.lock` SHA-256 hash gate + `npx agenthood diff` for drift
- **Permissions:** narrow-only `allowed-tools`: edits can never escalate privileges
- **Cadence:** gates run on every PR via CI; results are published per minor
  release in [docs/security-audit-report.md](docs/security-audit-report.md)

## Security-relevant files

- `.githooks/pre-commit`: secret scanning + main-branch protection
- `.github/workflows/pr.yml`: Auditor (Gitleaks + `npm audit`) gates
- `.github/scripts/`: shared analysis and decision-gate scripts
