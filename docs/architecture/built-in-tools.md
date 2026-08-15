# Built-in Tools

> *The Society's instruments. Each one scoped. Each one accountable.*

---

## Overview

The Agenthood maintains a core tool registry. Every tool is:

- **Named** — a clear, single-purpose identifier
- **Scoped** — available only to members whose role requires it
- **Capped** — subject to per-session usage limits
- **Logged** — every invocation recorded for audit

No member has access to every tool. A member that needs a tool outside its scope
must escalate to the Orchestrator, which routes to the appropriate member.

---

## Tool Registry

> **Canonical source:** [`src/members/MemberRegistry.ts`](../src/members/MemberRegistry.ts) and
> [`src/members/member-specs.ts`](../src/members/member-specs.ts) define every grant.
> This table mirrors them. Members with the **standard** profile (9): Scribe, Architect,
> Builder, Tester, Debugger, Herald, Librarian, Mailman, Inspector.
> Members with the **restricted** profile (10): Reviewer, Auditor, Doorman, Oracle, Envoy,
> Sentinel, Warden, Strategist, Steward, Operator. The **trusted** profile is reserved —
> no member currently holds it.

### File Operations

| Tool | Description | Scope |
|------|-------------|-------|
| `file.read` | Read file contents | All members |
| `file.write` | Write or overwrite a file | Standard profile (9 members) |
| `file.search` | Glob pattern file search | All members |

### Code Intelligence

| Tool | Description | Scope |
|------|-------------|-------|
| `code.explain` | Explain a code region | All members |
| `code.write` | Write code changes | Standard profile (9 members) |
| `code.refactor` | Refactor code | Standard profile (9 members) |

### PR Sync

| Tool | Description | Scope |
|------|-------------|-------|
| `pr_sync` | Sync a pull request | Trusted profile (no member currently) |

### External (MCP)

| Tool | Description | Scope |
|------|-------------|-------|
| `mcp.*` | Dynamically loaded MCP server tools | Per connector configuration |

---

## Safety Caps

Every tool invocation counts against session limits enforced by the `SafetyGuard`:

| Limit | Default | Maximum |
|-------|---------|---------|
| Total stream events | 2,000 | 10,000 |
| Total tool invocations | 400 | 2,000 |
| Session runtime | 10 minutes | 60 minutes |
| File edits per file | 8 | — |
| Terminal commands | 10 | — |
| Web searches | 8 | — |

When a cap is reached:
1. The member is notified with remaining budget
2. The member completes its current step cleanly
3. Control returns to the Orchestrator
4. The human is informed and can extend limits or resume

**Loop detection:** If the same file is edited 4+ times in a session, the SafetyGuard
alerts the member and requires it to justify continued editing or stop.

---

## Permission Profiles and Tools

| Tool | Restricted | Standard | Trusted |
|------|-----------|---------|---------|
| `file.read` / `file.search` / `code.explain` | ✅ | ✅ | ✅ |
| `file.write` / `code.write` / `code.refactor` | ❌ | ✅ | ✅ |
| `pr_sync` | ❌ | ❌ | ✅ |

**Profile membership (canonical in `member-specs.ts`):**
- **Standard (9):** Scribe, Architect, Builder, Tester, Debugger, Herald, Librarian, Mailman, Inspector
- **Restricted (10):** Reviewer, Auditor, Doorman, Oracle, Envoy, Sentinel, Warden, Strategist, Steward, Operator
- **Trusted (0):** reserved — no member currently holds it

**Catastrophic commands are blocked universally:**
`rm -rf /`, `mkfs`, `dd if=/dev/zero`, `DROP DATABASE`, force push to main.

---

## Tool Audit Log

Every tool invocation is logged with:
- Timestamp
- Member that invoked it
- Tool name and parameters
- Result (success / error / blocked)
- Session and task ID

The audit log is stored in `.agenthood/audit.log` and rotated at 1,000 entries.
The Auditor can query it. The human can always read it.

Beyond tool invocations, the runtime records a decision and provenance entry
per member run — the tamper-evident audit trail in `.agenthood/decisions/` and
`.agenthood/provenance/` (SHA-256 hash chain, see
[decision-intelligence.md](decision-intelligence.md)). `verifyChain()` proves
the trail has not been modified or truncated.
