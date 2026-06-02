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

### File Operations

| Tool | Description | Scope |
|------|-------------|-------|
| `file.read` | Read file contents | All members |
| `file.write` | Write or overwrite a file | Architect, Tester, Herald, Librarian, Scribe |
| `file.edit` | Targeted string replacement in a file | Architect, Tester, Herald, Librarian, Scribe |
| `file.delete` | Delete a file (requires approval) | Architect only |
| `file.list` | List directory contents | All members |
| `file.search` | Glob pattern file search | All members |

### Code Intelligence

| Tool | Description | Scope |
|------|-------------|-------|
| `code.grep` | Ripgrep content search with regex | All members |
| `code.symbols` | Extract symbols, functions, classes | Reviewer, Architect, Debugger |
| `code.analysis` | Full codebase structural analysis | Architect, Reviewer |
| `code.diagnostics` | Read linter/compiler diagnostics | Reviewer, Debugger, Doorman |

### Terminal

| Tool | Description | Scope |
|------|-------------|-------|
| `terminal.run` | Execute a shell command | Tester, Debugger, Doorman |
| `terminal.deep` | Long-running process with streaming output | Debugger only |

### Git

| Tool | Description | Scope |
|------|-------------|-------|
| `git.diff` | Show staged or unstaged changes | Scribe, Reviewer, Doorman |
| `git.log` | Commit history with formatting | Scribe, Herald, Doorman |
| `git.status` | Working tree status | All members |
| `git.branch` | List, create, switch branches | Architect, Doorman |
| `git.commit` | Create a commit (requires approval) | Scribe only |
| `git.push` | Push to remote (requires approval) | Herald only |
| `git.tag` | Create a version tag (requires approval) | Herald only |

### Search & Knowledge

| Tool | Description | Scope |
|------|-------------|-------|
| `search.web` | Web search for current information | Architect, Auditor, Librarian |
| `search.vector` | Semantic search across indexed codebase | All members |
| `search.hybrid` | Vector + keyword + temporal decay | Architect, Reviewer, Librarian |

### Debug

| Tool | Description | Scope |
|------|-------------|-------|
| `debug.stacktrace` | Parse and analyze a stack trace | Debugger only |
| `debug.variables` | Inspect runtime variable state | Debugger only |
| `debug.evaluate` | Evaluate an expression in debug context | Debugger only |
| `debug.control` | Step/continue/pause debugger | Debugger only |

### Memory & State

| Tool | Description | Scope |
|------|-------------|-------|
| `memory.read` | Read from persistent project/user memory | All members |
| `memory.write` | Write to persistent memory | All members |
| `tasks.read` | Read current task list | All members |
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

| Tool Category | Restricted | Standard | Trusted |
|---------------|-----------|---------|---------|
| File read | ✅ | ✅ | ✅ |
| File write/edit | ❌ | ✅ (diff review) | ✅ (auto-approve) |
| File delete | ❌ | ✅ (approval) | ✅ (approval) |
| Terminal (safe) | ❌ | ✅ | ✅ |
| Terminal (dangerous) | ❌ | ✅ (approval) | ✅ (approval) |
| Terminal (catastrophic) | ❌ | ❌ | ❌ |
| Git commit/push | ❌ | ✅ (approval) | ✅ (approval) |
| Web search | ✅ | ✅ | ✅ |
| MCP tools | ❌ | ✅ | ✅ |

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
