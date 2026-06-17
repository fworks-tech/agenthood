# ADR-004: 14 Specialized Members Over a General-Purpose Agent

**Date:** 2026-06-02
**Status:** Accepted

## Context

An AI coding assistant framework could be designed as a single general-purpose
agent ("do everything") or as a roster of specialists each responsible for
a defined domain. The number and boundaries of specialists needed to be chosen.

The Society settled on 14 members after iterating from an initial 9.
The 5 additions (The Oracle, The Envoy, The Sentinel, The Warden, The Steward)
filled gaps discovered during real-world use.

## Decision

The Society uses 14 specialized members, each with a named role, a defined
trigger condition, and a focused skill file. No general-purpose member exists.

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|-------------|
| Single general agent | Simple; no routing required | Context bloat; the agent must hold all knowledge simultaneously; no clear ownership | Degrades quality as scope grows |
| Fewer, broader members (e.g., 4–5) | Easier to learn | Broad members produce diluted guidance; unclear when to invoke | Blurs accountability |
| 14 specialized members (chosen) | Each member loads only relevant context; clear trigger conditions; easy to add/remove | Requires routing logic; adopters must learn which member to invoke | — |
| More members (20+) | Maximum specialization | Diminishing returns; cognitive overhead for adopters | Premature for current scope |

## Consequences

**Easier:** Each member's skill file is small and focused — it loads quickly
and fits within context budgets. Adding a new member does not affect existing
members.

**Harder:** Adopters must understand enough about the roster to invoke the
right member. The Steward exists specifically to solve this routing problem.

**New risk:** Gaps between member domains can cause tasks to fall through
the cracks. The Oracle covers institutional knowledge that does not belong
to any specialist.

## References

- [members/README.md](../../members/README.md) — full member registry
- [members/the-steward/SKILL.md](../../members/the-steward/SKILL.md) — routing member
- [architecture/agent-system.md](../../architecture/agent-system.md) — system design
