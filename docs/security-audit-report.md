# Agenthood Security Self-Audit Report

> Snyk's ToxicSkills audit (Feb 2026) found 36.82% of public `SKILL.md` files
> had security flaws. This report shows the Society audits itself — with its
> own gates, on every change.

## Methodology

Three automated gates run against all 20 member skills; CI adds secret and
dependency scanning on every PR:

1. **Contract gate** (`npx agenthood verify`) — frontmatter shape
   (`name`/`description`/`allowed-tools`), name↔directory match, placeholder
   hygiene. A skill that cannot be parsed never loads.
2. **Integrity gate** (`agenthood.lock` SHA-256 + `npx agenthood diff`) — the
   injected `SKILL.md` must match the locked hash; drift warns by default and
   blocks with `security.strictSkillIntegrity: true`.
3. **Permission gate** (narrow-only `allowed-tools`) — a declaration can only
   narrow the tool surface below the member's profile, never widen it, so a
   `SKILL.md` edit can never escalate privileges.
4. **CI gates** — Gitleaks secret scanning and `npm audit` (Auditor) fail the
   PR on findings outside npm's own bundled dependencies.

## Results (v3.67.0, 2026-09-25)

| Gate | Result |
|------|--------|
| `verify` — 20/20 member skills | ✅ all pass |
| `diff` vs `agenthood.lock` | ✅ no differences, no drift |
| `doctor` — skill files + lockfile integrity | ✅ 20/20 installed, 20 locked, no drift |
| Trust-boundary tagging (`memberLore.ts`) | ✅ skill content, tool output, and context wrapped |

No untrusted third-party skills ship in this repository. The residual risk is
prompt content inside skill bodies — mitigated by boundary tags and the
narrow-only tool rule, not by scanning alone.

## Audit cadence

Gates 1–3 run on every `verify` invocation and in CI on every PR. This report
is refreshed each minor release; the next refresh covers prompt-injection
pattern detection (#606) and per-file script checksums (#604).

## Reporting

See [SECURITY.md](../SECURITY.md) — private advisory flow or `inbox@flabs.tech`,
acknowledgement within 48 hours.
