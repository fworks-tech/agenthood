# Execution Order — Open Milestones (2026-09)

Snapshot date: **2026-09-19**, generated from the live milestone list
(`gh api repos/:owner/:repo/milestones`). The previous version of this
document (2026-08-20) sequenced a retired M10–M17 milestone set whose
issue numbers no longer reflect the tracker; treat that ordering as
superseded. Milestones are now priority-labeled (P0/P1/P2).

## Milestone snapshot (2026-09-19)

| Milestone | Open | Closed | State |
|-----------|------|--------|-------|
| #26 P0: Security & Supply Chain | 0 | 4 | **delivered** |
| #27 P0: Runtime Stability & Data Integrity | 0 | 5 | **delivered** |
| #28 P1: Testing & Quality Assurance | 0 | 24 | **delivered 2026-09-19** (eval framework + description optimizer verified live) |
| #35 P1: Ecosystem & Integration | 0 | 34 | **delivered** |
| #31 P1: Developer Experience | 11 | 8 | in flight — 2026-09-19 sprint shipped init idempotency, eject sweep, list token budget, diff, remove, create, upgrade --agenthood, init --ci, failover dedup, --sandbox phase 1 (see branches feat/*) |
| #29 P1: Cross-Client Compatibility | 27 | 1 | next up (#642/#654/#662 form one init-targeting epic) |
| #33 P1: Observability & Monitoring | 14 | 1 | open |
| #36 P1: Documentation & Onboarding | 17 | 0 | open |
| #30 P2: Performance & Scalability | 9 | 0 | backlog |
| #32 P2: Advanced Orchestration | 15 | 0 | backlog |
| #34 P2: Skill Format & Metadata | 42 | 0 | backlog |

## Ranking principles

1. **Dependency correctness** — design gates precede the work they
   specify; ADR-023 (third-party member API) is landed, so #154/#155
   (authoring API + creator guide) are unblocked.
2. **Priority weight** — all four remaining P1 milestones before any P2.
3. **Milestone completeness** — finish #29 (Cross-Client) next: it is
   thematically one epic (#642 + #654 + #662: `.agents/skills/` as the
   primary cross-client location plus a `--target` flag) and closes the
   largest single coherent chunk.

## Suggested order

1. Land the 2026-09-19 DX sprint branches (9 open PRs, one concern each).
2. **#29 Cross-Client Compatibility** — init-targeting epic first
   (#642, #654, #662), then the remaining compatibility items.
3. **#31 DX remainder** — #646 (unified error handling) and #647
   (--json sweep) are mechanical sweeps; run them AFTER the current
   sprint lands so they also cover the new commands.
4. **#33 Observability** and **#36 Documentation** in parallel.
5. P2 milestones (#30, #32, #34) after the P1 set is closed.

## Maintenance rule

Regenerate the snapshot table from the live milestone API whenever this
document is touched — the 2026-08-20 staleness (retired issue numbers,
passed wave dates) is exactly what happens when the table is hand-edited.
