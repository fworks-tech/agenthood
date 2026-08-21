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
| **The Scribe** | Written communication | Commit messages, PR descriptions | Reviewer (what changed), Herald (version context) | Tester, Doorman | Architect |
| **The Architect** | Design & planning | Specs, ADRs, task decomposition, branch scope | Oracle (prior art), Strategist (requirements) | Tester, Reviewer, Scribe | Strategist |
| **The Builder** | Implementation | Smallest verified change, local validation, handoff | Architect (spec), Tester (test contract) | Reviewer, Scribe | Architect |
| **The Reviewer** | Code quality | Review criteria, Approval gates | Tester (test results), Auditor (security findings) | Scribe, Architect | Auditor |
| **The Tester** | Test coverage | TDD process, coverage targets, test types | Architect (spec), Reviewer (areas changed) | Debugger, Scribe | Architect |
| **The Debugger** | Error recovery | Root cause protocol, investigation steps | Tester (failing tests), Reviewer (recent changes) | Auditor, Scribe | Operator |
| **The Auditor** | Security | OWASP, secrets, dependency vulnerabilities | Warden (smells), Librarian (history) | Reviewer, Debugger | Sentinel |
| **The Herald** | Releases | Semver, changelogs, release notes | Scribe (commit log), Librarian (docs status) | All | Strategist |
| **The Mailman** | Delivery | Message dispatch, Content scheduling, Cross-posting | Herald (release timing), Librarian (content) | All | Steward |
| **The Librarian** | Documentation | ADR storage, doc sync, knowledge management | Architect (decisions), Oracle (naming) | Herald, Sentinel | Oracle |
| **The Doorman** | Enforcement | Hook setup, Lint, Gate checks, Health checks | Sentinel (drift), Warden (complexity) | All | Sentinel |
| **The Oracle** | Society knowledge | Member templates, naming, registration maps | Sentinel (drift data), Librarian (docs) | All | Sentinel |
| **The Envoy** | Provider translation | Skill format mapping, Bootstrap, Skill matrix | Oracle (template spec), Sentinel (consistency) | All | Steward |
| **The Sentinel** | Society integrity | Member consistency, contradiction detection, drift | Oracle (template), Warden (code quality) | All | Steward |
| **The Warden** | Code health | Smell identification, Architectural decay, Complexity | Sentinel (member structure), Auditor (security) | Reviewer, Architect | Sentinel |
| **The Steward** | Context economy | Load routing, cache strategy, session triage | Envoy (provider limits), Oracle (member load) | All | — |
| **The Strategist** | Requirement discovery | Problem statements, Success measures, Ranked priorities | Oracle (prior art), Architect (feasibility) | Architect, Herald | — |
| *The Mediator* | Workflow orchestration | Sequencing, handoffs, conflict resolution | Steward (load routing), Architect (task structure) | All | Steward |
| **The Operator** | Runtime health | Deployment, incidents, rollback, monitoring | Debugger (failures), Herald (releases) | All | — |
| **The Inspector** | Visual-reasoning benchmarking | Pixel-level analysis, Multi-panel correspondence | Tester (benchmark design), Oracle (naming conventions) | Reviewer, Sentinel | Steward |

*Italic rows = planned but not yet shipped. Strategist and Operator shipped in M7 (PR #288). Inspector shipped in M8.*

## Lane Boundaries

**No two members may own the same decision.** When overlap is detected:
1. The Sentinel flags it
2. The Oracle proposes a boundary

**Owned decisions are recorded.** Every member run writes its decision to the
decision log (`.agenthood/decisions/`) with a provenance entry — the RACI map
is enforced by process, and the audit trail makes each member's decisions
queryable and provable.

## Escalation Rules

1. **When blocked:** Escalate to the member in your "Escalate To" column
2. **When escalation fails:** Escalate to The Steward
3. **When The Steward is blocked:** The task is deferred and the human is notified
4. **Never:** Two members should resolve a conflict by both doing the work — that is duplicated effort
