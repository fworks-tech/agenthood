# Member Map — RACI

> *Every member knows their lane. This is the map.*

---

## What this is

A RACI (Responsible / Accountable / Consulted / Informed) matrix documenting all Society members. Every member has:
- **Lane** — single-sentence specialty
- **Owned decisions** — what this member alone decides
- **Consulted members** — who they must consult before deciding
- **Informed members** — who gets notified after a decision
- **Escalation path** — who to escalate to when blocked

## The Map

| Member | Lane | Owned Decisions | Consult | Inform | Escalate To |
|--------|------|-----------------|---------|--------|-------------|
| **The Scribe** | Written communication | Commit messages, PR descriptions, changelogs | Reviewer (what changed), Herald (version context) | Tester, Doorman | Architect |
| **The Architect** | Design & planning | Specs, ADRs, task decomposition, branch scope | Oracle (prior art), Strategist (requirements) | Tester, Reviewer, Scribe | Strategist |
| **The Reviewer** | Code quality | Review criteria, approval gates, diff analysis | Tester (test results), Auditor (security findings) | Scribe, Architect | Auditor |
| **The Tester** | Test coverage | TDD process, coverage targets, test types | Architect (spec), Reviewer (areas changed) | Debugger, Scribe | Architect |
| **The Debugger** | Error recovery | Root cause protocol, investigation steps | Tester (failing tests), Reviewer (recent changes) | Auditor, Scribe | Operator |
| **The Auditor** | Security | OWASP, secrets, dependency vulnerabilities | Warden (smells), Librarian (history) | Reviewer, Debugger | Sentinel |
| **The Herald** | Releases | Semver, changelogs, release notes | Scribe (commit log), Librarian (docs status) | All | Strategist |
| **The Librarian** | Documentation | ADR storage, doc sync, knowledge management | Architect (decisions), Oracle (naming) | Herald, Sentinel | Oracle |
| **The Doorman** | Enforcement | Hook setup, lint, validation, health checks | Sentinel (drift), Warden (complexity) | All | Sentinel |
| **The Oracle** | Society knowledge | Member templates, naming, registration maps | Sentinel (drift data), Librarian (docs) | All | Sentinel |
| **The Envoy** | Provider translation | Skill format mapping, bootstrap, coverage matrix | Oracle (template spec), Sentinel (consistency) | All | Steward |
| **The Sentinel** | Society integrity | Member consistency, contradiction detection, drift | Oracle (template), Warden (code quality) | All | Steward |
| **The Warden** | Code health | Smell detection, architectural decay, complexity | Sentinel (member structure), Auditor (security) | Reviewer, Architect | Sentinel |
| **The Steward** | Context economy | Member routing, cache strategy, session triage | Envoy (provider limits), Oracle (member load) | All | — |
| **The Strategist** | Requirement discovery | Problem definition, success criteria, prioritization | Oracle (prior art), Architect (feasibility) | Architect, Herald | — |
| *The Mediator* | Workflow orchestration | Sequencing, handoffs, conflict resolution | Steward (member routing), Architect (task structure) | All | Steward |
| **The Operator** | Runtime health | Deployment, incidents, rollback, monitoring | Debugger (failures), Herald (releases) | All | — |

*Italic rows = planned but not yet shipped. Strategist and Operator shipped in M6 (PR #288).*

## Lane Boundaries

**No two members may own the same decision.** When overlap is detected:
1. The Sentinel flags it
2. The Oracle proposes a boundary
3. The Steward routes to the appropriate sole owner

## Escalation Rules

1. **When blocked:** Escalate to the member in your "Escalate To" column
2. **When escalation fails:** Escalate to The Steward
3. **When The Steward is blocked:** The task is deferred and the human is notified
4. **Never:** Two members should resolve a conflict by both doing the work — that is duplicated effort
