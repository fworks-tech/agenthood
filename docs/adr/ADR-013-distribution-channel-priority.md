# ADR-013: Distribution Channel Priority

**Date:** 2026-06-24
**Status:** Accepted

## Context

Agenthood has four distribution channels available simultaneously. With a single maintainer and limited time, investing equally in all four is a mistake. This ADR decides which channel gets optimised first, second, and third — and what the criteria are for re-prioritising.

The four channels:

1. **npm** — `npm install --save-dev agenthood`. Published automatically via `@semantic-release/npm` on every `main` push. Currently published as latest (managed by semantic-release). Requires keyword optimisation for discoverability.
2. **Skills.sh** — 600k+ skills marketplace, Vercel-backed. Skills appear automatically once installed via `npx agenthood init`. Zero-cost listing via `skills.sh.json`.
3. **VS Code Marketplace** — IDE extension (`agenthood-vscode`). Published via `.github/workflows/vscode-extension.yml`. Currently at v0.1.0. Requires publisher account setup and ongoing maintenance.
4. **SkillsMP** — 1.7M+ skills, GitHub-scrape-based. Requires 2+ stars for listing. Star count currently insufficient.

## Decision

**Priority order (highest to lowest):**

1. **npm** — Already published, keyword optimisation is immediate. The primary adoption trigger for the CLI. One `package.json` change + compounding discoverability via weekly download stats.
2. **Skills.sh** — Zero additional cost. Once `npx agenthood init` is run, skills appear automatically on the leaderboard. Seed installs are the only activation needed. Groupings already configured in `skills.sh.json`.
3. **VS Code Marketplace** — Requires publisher account verification (1–2 hours setup). High ongoing visibility but lower engagement intensity than CLI users. Extension at v0.1.0 — feature-complete for web views but not yet a primary adoption driver.
4. **SkillsMP** — Blocked by the 2-star gate. Comes naturally as npm + skills.sh drive star growth.

This order reflects the **minimum effort for maximum incremental visibility** principle. Each channel is optimised only when the previous channel is fully operational.

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|-------------|
| Skills.sh first | Highest traffic (600k+), Vercel-backed leaderboard | Leaderboard position is purely install-count; gaming is possible | Without npm adoption, there are no seed installs to drive the leaderboard |
| SkillsMP first | 1.7M+ skills, GitHub-scrape-based (no manual submission) | Requires 2+ stars gate; no control over listing timing | Blocked by current star count — cannot act on it now |
| VS Code Marketplace first | Direct IDE integration; one-click trial | Lower engagement than CLI users; publisher setup overhead | Not yet feature-complete enough to justify the setup investment |

## Consequences

**Easier:**
- Clear ordering removes decision paralysis — always know which channel to work on next
- npm and Skills.sh compound benefits: npm downloads increase stars, stars unlock SkillsMP
- Semantic release pipeline already publishes npm automatically — no new infrastructure needed

**Harder:**
- VS Code Marketplace and SkillsMP remain inactive until npm and Skills.sh reach targets
- If npm keyword optimisation does not move the needle within 4 weeks, the entire strategy pivots

**Re-prioritisation trigger:**
If npm weekly downloads do not reach 50 within 4 weeks of keyword optimisation, escalate VS Code Marketplace to #2 priority and begin active publisher setup. Skills.sh and SkillsMP priorities remain unchanged in this scenario — Skills.sh is already zero-cost and SkillsMP remains star-gated regardless of channel priority.

## References

- [.releaserc.json](../../.releaserc.json) — semantic-release configuration with `@semantic-release/npm` plugin
- [.github/workflows/semantic-release.yml](../../.github/workflows/semantic-release.yml) — automated npm publish on `main` push
- [skills.sh.json](../../skills.sh.json) — Skills.sh marketplace groupings configuration
- [vscode-extension/package.json](../../vscode-extension/package.json) — VS Code extension manifest (publisher: `fworks-tech`)
- [.github/workflows/vscode-extension.yml](../../.github/workflows/vscode-extension.yml) — VS Code extension publish workflow
