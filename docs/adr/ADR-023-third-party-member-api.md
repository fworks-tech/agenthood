# ADR-023: Third-Party Member Plugin API

**Date:** 2026-09-04
**Status:** Proposed
**Closes:** #159 (requested as ADR-012; numbers ADR-011/ADR-012 already taken)

## Context

M13 — Community & Ecosystem needs an extension model before the contrib guide can be written. Choice affects discovery, npm dependency chain, and install-time trust. Foundational constraint: ADR-001 Markdown skills over code agents. Threat context: ToxicSkills — 36.8% of public skills have flaws — so zero-gate discovery is unsafe.

## Decision

Adopt **Option D — Hybrid: registry-first discovery + curated allowlist**. Anyone can publish a GitHub repo with SKILL.md (Envoy auto-detects via Skills.sh/SkillsMP); `npx agenthood activate` warns when a member is not on the curated `TRUSTED_MEMBERS.md` allowlist. `members/contrib/` PR path remains for promotion into the allowlist, with Sentinel structural validation.

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|--------------|
| A — contrib/ PR-first | Full QC; CI enforces structure | Maintainer bottleneck; no async publish | Keep as allowlist promotion path, not sole path |
| B — npm scoping | Scales; versioning free | Package overhead per skill; no gate | Unneeded dependency chain for Markdown skills |
| C — Registry-first only (chosen in part) | Zero infra; open standard | No quality gate; ToxicSkills risk | Accepted for discovery, rejected as sole trust model |
| D — Hybrid (chosen) | Scales; trust signal; self-serve | Allowlist curation burden | Smallest burden; mitigates ToxicSkills |

## Consequences

Easier: community self-serves; trust preserved via allowlist warning.
Harder: allowlist curation + Sentinel validation + `author/source_url` frontmatter required.
Risks: allowlist staleness; must document promotion criteria in contrib guide (#154 blocked on this ADR).

## References

- #159 (M13 — Community & Ecosystem)
- ADR-001 markdown skills over code agents
- #154 contrib API design (blocked), #155 creator guide (blocked on #154)
