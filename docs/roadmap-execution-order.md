# Execution Order — Open Milestones (2026-08)

Today: 2026-08-20. This document is the working roadmap for the 27 open
issues across 7 open milestones. It sequences work by due-date pressure,
priority weight, and dependency correctness, and groups it into waves so
each milestone is completed as a clean, verifiable unit.

Open milestones and due dates:

| Milestone | Due | Open issues |
|-----------|-----|-------------|
| M11 — Distribution & Traction | 2026-08-31 | 5 |
| M10 — Foundation Patterns | 2026-08-31 | 3 |
| M12 — Platform | 2026-09-14 | 1 |
| M13 — Community & Ecosystem | 2026-09-30 | 5 |
| M14 — Advanced Patterns & Quality | 2026-09-30 | 7 |
| M15 — Multimodal | 2026-11-30 | 1 |
| M17 — Skills Maintenance & Hygiene | none | 4 |

## Ranking Principles

1. **Dependency correctness** — ADR/design issues precede the implementation
   they specify (ADR-012 precedes the authoring API it defines; ADR-011
   precedes monetisation work).
2. **Due-date pressure** — the two 2026-08-31 milestones go before the
   09-14/09-30 ones, which go before the 11-30 one.
3. **Priority weight** — p1 before p2 before p3, as a tiebreaker within a
   due-date window.
4. **Milestone completeness** — prefer finishing a milestone end-to-end so
   each "done" is a verifiable unit.

## Wave 1 — Due 2026-08-31 (do now, ~11 days)

### M11 — Distribution & Traction (5 issues)

1. **#147** `feat(distribution): submit agenthood to Skills.sh` — p1. External
   submission; initiate first to start the review clock.
2. **#148** `feat(distribution): submit all 14 members to SkillsMP registry` — p1.
3. **#149** `feat(distribution): publish agenthood-vscode extension to VS Code
   Marketplace` — p1. External; initiate alongside #147/#148.
4. **#152** `feat(distribution): publish Agenthood security posture report
   (ToxicSkills counter-positioning)` — p2. Pairs with the security posture
   work; produces the report referenced by the distribution material.
5. **#151** `docs(pt-br): add Portuguese README section and Groq zero-cost
   setup guide` — p2. Shift-8 market reach; lowest dependency in this wave.

### M10 — Foundation Patterns (3 issues)

1. **#323** `fix(groq): address Auditor warnings from PR #322 review` —
   security fail-fast; small, self-contained, unblocks the Groq provider line.
2. **#339** `feat: add web-research skill from deepagents` — p2. New capability
   port; no dependency on #323.
3. **#345** `feat: add async-subagent-server example/pattern from deepagents` —
   p2, core+security. Most involved of the wave; last to leave the security
   and review surface clean.

## Wave 2 — Due 2026-09-14

### M12 — Platform (1 issue)

1. **#158** `docs(adr): ADR-011 — monetisation model` — p1. Design gate; must
   land before any monetisation implementation. Series-adjacent with #159.

## Wave 3 — Due 2026-09-30

### M13 — Community & Ecosystem (5 issues; #159 pulled forward)

> Rationale: ADR-012 (#159, p1) gates the authoring API (#154). It ships in
> Wave 2's wake so the API can be designed against a settled decision rather
> than reshaped after the fact.

1. **#159** `docs(adr): ADR-012 — third-party member plugin API` — p1. Pulled
   forward; resolves the contrib/ vs npm vs registry-first decision.
2. **#154** `feat(community): design third-party member authoring API
   (contrib/ pattern)` — depends on #159's decision.
3. **#155** `docs(community): write external member creator guide using The
   Oracle template` — consumes #154's API.
4. **#157** `feat(community): create community members showcase` — p3.
5. **#156** `feat(community): set up GitHub Discussions` — p3.

### M14 — Advanced Patterns & Quality (7 issues; CI/test first)

> Rationale: stable test/CI signal is a prerequisite for safely landing the
> four deepagents feature ports. Runway is unblocked before feature work lands.

1. **#464** `fix(ci): add bun to test environment or migrate e2e to vitest` —
   p2. Decides and stabilizes the e2e runner.
2. **#465** `fix(test): flaky timeouts in command-registry and LLMRouter
   tests` — p3. Deterministic test signal on the stabilized runner.
3. **#470** `fix(security): surface no-lockfile integrity state and reduce
   MemberAgent constructor arity` — p2, core+security. Small; do with/after
   the CI fixes.
4. **#344** `feat: add content-builder-agent` — p2 feature port.
5. **#343** `feat: add deep-research` — p2 feature port.
6. **#342** `feat: add deploy-coding-agent` — p2 feature port.
7. **#341** `feat: add deploy-content-writer` — p2 feature port.

## Wave 4 — Due 2026-11-30 + open-ended

### M15 — Multimodal (1 issue)

1. **#124** `feat(llm): implement IMultimodalProvider` — large, single issue,
   furthest out. Last unless unblocked earlier.

### M17 — Skills Maintenance & Hygiene (4 issues, no due date)

> "Whenever" hygiene bucket. Slot in as capacity opens or opportunistically
> between waves; simplest (#450) first.

1. **#450** `fix(skills): clarify accessibility-auditor ARIA section scope`
2. **#451** `refactor(skills): split pull-request-assistant into description
   and review flows`
3. **#452** `refactor(skills): deduplicate reviewer and tester red flags`
4. **#453** `docs(skills): de-hardcode librarian postmortem internals`

## ADRs to record

- **ADR-011** — monetisation model (issue #158)
- **ADR-012** — third-party member plugin API: contrib/ vs npm scoping vs
  registry-first (issue #159)

Both ADRs are design gates; write them before the implementation(s) they
specify begin. See `docs/adr/` for existing records.
