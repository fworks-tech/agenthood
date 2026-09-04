# ADR-022: Monetisation Model

**Date:** 2026-09-04
**Status:** Proposed
**Closes:** #158 (requested as ADR-011; numbers ADR-011/ADR-012 already taken)

## Context

Agenthood is MIT-licensed and free to use. M12 — Platform plans an Express API and multi-tenancy, but the monetisation model driving auth, rate limiting, namespacing, and billing choices is undecided. Deciding before implementation avoids rework. Constraints: solo maintainer, Brazil market, MIT base, zero billing infra today.

## Decision

Adopt **Option B — Open-core (freemium)** as the default direction for M12 design: core skills + runtime stay free and MIT; advanced members, hosted execution, and team management are paid. `api.agenthood.dev` rate limits enforce tiers. Revisit Option C (usage-based hosted API) only after distribution gates clear.

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|--------------|
| A — Pure open-source, services only | Zero infra; Brazil fit | No product revenue; differentiation low | Defers sustainability; keeps M12 billing out of scope entirely |
| B — Open-core freemium (chosen) | Medium time-to-revenue; feasible solo; Brazil fit; Agensi 80/20 precedent | Medium infra (auth, tiers, entitlements) | — |
| C — SaaS hosted API per-token | Fastest revenue; high differentiation | High infra; abuse/billing burden solo | Defer until after B; revisit post-M11 traction |
| D — Commercial licence >5 seats (SSO, audit, SLA) | High differentiation | Slow revenue; enterprise sales burden | Defer; no enterprise pipeline today |

## Consequences

Easier: M12 API ships with tier-aware auth/rate limits from day one; pricing copy maps to entitlements.
Harder: requires entitlement checks, metering, and a paid plan surface.
Risks: allowlist/entitlement scope creep; must keep MIT core genuinely usable.

## References

- #158 (M12 — Platform)
- ADR-011 rate-limiter (numbering note: this ADR takes next free number ADR-022)
- Agensi creator payments: https://agensi.io
