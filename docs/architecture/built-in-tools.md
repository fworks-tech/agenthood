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
| `file.edit` | Targeted string replacement in a file | Standard profile (9 members) |
| `file.delete` | Delete a file (requires approval) | Trusted profile (no member currently) |
| `file.list` | List directory contents | All members |
| `file.search` | Glob pattern file search | All members |
### Code Intelligence

| Tool | Description | Scope |
|------|-------------|-------|
| `code.symbols` | Extract symbols, functions, classes | Trusted profile (no member currently) |
| `code.analysis` | Full codebase structural analysis | Trusted profile (no member currently) |
| `code.diagnostics` | Read linter/compiler diagnostics | Trusted profile (no member currently) |

### Terminal

| Tool | Description | Scope |
|------|-------------|-------|
| `terminal.run` | Execute a shell command | Standard profile (9 members) |

### Git

| Tool | Description | Scope |
|------|-------------|-------|
| `git.diff` | Show staged or unstaged changes | Standard profile (9 members) |
| `git.log` | Commit history with formatting | Standard profile (9 members) |
| `git.status` | Working tree status | Standard profile (9 members) |
| `git.branch` | List, create, switch branches | Standard profile (9 members) |
| `git.commit` | Create a commit (requires approval) | Trusted profile (no member currently) |
| `git.push` | Push to remote (requires approval) | Trusted profile (no member currently) |
| `git.tag` | Create a version tag (requires approval) | Trusted profile (no member currently) |

### Search & Knowledge

| Tool | Description | Scope |
|------|-------------|-------|
| `search.web` | Web search for current information | Trusted profile (no member currently) |
| `search.vector` | Semantic search across indexed codebase | Trusted profile (no member currently) |
| `search.hybrid` | Vector + keyword + temporal decay | Trusted profile (no member currently) |

### Debug

| Tool | Description | Scope |
|------|-------------|-------|
| `debug.stacktrace` | Parse and analyze a stack trace | Trusted profile (no member currently) |
| `debug.variables` | Inspect runtime variable state | Trusted profile (no member currently) |
| `debug.evaluate` | Evaluate an expression in debug context | Trusted profile (no member currently) |
| `debug.control` | Step/continue/pause debugger | Trusted profile (no member currently) |

### Memory & State

| Tool | Description | Scope |
|------|-------------|-------|
| `memory.read` | Read from persistent project/user memory | All members |
| `memory.write` | Write to persistent memory | Standard and Trusted |
| `tasks.write` | Update task status | All members |
| `think` | Chain-of-thought reasoning scratchpad | All members |

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
| `file.read` / `file.list` / `file.search` | ✅ | ✅ | ✅ |
| `memory.read` / `tasks.write` / `think` | ✅ | ✅ | ✅ |
| `memory.write` | ❌ | ✅ | ✅ |
| `file.write` / `file.edit` | ❌ | ✅ | ✅ |
| `terminal.run` | ❌ | ✅ | ✅ |
| `git.status` / `git.diff` / `git.log` / `git.branch` | ❌ | ✅ | ✅ |
| `file.delete` | ❌ | ❌ | ✅ (approval) |
| `git.commit` / `git.push` / `git.tag` | ❌ | ❌ | ✅ (approval) |
| `code.symbols` / `code.analysis` / `code.diagnostics` | ❌ | ❌ | ✅ |
| `search.web` / `search.vector` / `search.hybrid` | ❌ | ❌ | ✅ |
| `debug.*` | ❌ | ❌ | ✅ |

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
