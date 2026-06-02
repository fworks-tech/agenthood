# Agent System

> *The Society is not one agent. It is fourteen specialists who know when to call each other.*

---

## Overview

The Agenthood uses a **multi-agent architecture** where a central Orchestrator
coordinates fourteen specialized members. No member tries to do everything.
Each receives only the tools and context relevant to their specialty.

This design avoids the failure mode of monolithic agents: an agent given every
tool and every responsibility becomes unpredictable, slow, and hard to debug.

---

## The Orchestrator

The Orchestrator is the Society's dispatch system. It:

- Receives incoming requests and classifies them by type
- Routes work to the appropriate member(s)
- Manages the publish/subscribe event bus between members
- Tracks the state of multi-step tasks across member handoffs
- Never does the work itself — it only coordinates

**Key principle:** Every member communicates *through* the Orchestrator,
never directly to each other. This decouples the system and makes behavior
predictable and auditable.

```
User Request
     ↓
 Orchestrator
  ↙  ↓  ↓  ↘
Scribe Reviewer Tester Doorman ...
```

---

## The Members as Subagents

Each member is a subagent with:

| Property | Description |
|----------|-------------|
| **Role** | A single, well-defined specialty |
| **Tool scope** | Only the tools needed for their role |
| **Permission profile** | Restricted / Standard / Trusted |
| **Handoff protocol** | How they signal completion to the Orchestrator |
| **Escalation path** | What to do when they can't proceed alone |

### Member → Tool Scope

Full tool-scope definitions live in [`built-in-tools.md`](built-in-tools.md) and are
implemented as `SubAgent` TypedDicts in [`runtime/agenthood_runtime/members/specs.py`](../runtime/agenthood_runtime/members/specs.py).

| Member | Key Tools | Permission Profile |
|--------|-----------|--------------------|
| The Scribe | git.diff, git.log, git.commit, file.write | standard |
| The Architect | file.write, file.delete, code.analysis, search.web | standard |
| The Reviewer | file.read, code.symbols, code.diagnostics | restricted |
| The Tester | file.write, terminal.run, code.grep | standard |
| The Debugger | terminal.run, terminal.deep, debug.* | standard |
| The Auditor | file.read, code.diagnostics, search.web | restricted |
| The Herald | git.push, git.tag, file.write, search.web | standard |
| The Librarian | file.write, search.web, search.hybrid | standard |
| The Doorman | git.diff, git.log, code.diagnostics | restricted |
| The Oracle | git.log, search.vector, search.hybrid | restricted |
| The Sentinel | file.read, code.diagnostics | restricted |
| The Warden | code.grep, code.diagnostics | restricted |
| The Envoy | file.read, search.web, search.vector | restricted |
| The Steward | memory.read, memory.write, tasks.* | restricted |

---

## The Reason → Act → Observe Loop

Each member operates on a three-step cycle:

```
REASON    → Read context, form a plan, identify tools needed
   ↓
ACT       → Execute tools, make changes, call external services
   ↓
OBSERVE   → Read output, assess result, decide next step
   ↓
(repeat until task complete or escalation needed)
```

The loop continues until:
- The task is complete (success)
- A safety limit is reached (see [built-in-tools.md](built-in-tools.md))
- Human approval is required (destructive action gate)
- The member escalates to the Orchestrator for handoff

---

## Self-Healing

When a member encounters an error during execution:

1. Read the full error output — not just the first line
2. Classify: is this recoverable or not?
3. If recoverable: apply correction and retry
4. If not recoverable: escalate with a clear description of what failed and why
5. Never silently swallow errors or add empty catch blocks to proceed

---

## Multi-Member Tasks

Some tasks span multiple members. The Orchestrator manages the handoff:

**Example: "Review and ship this PR"**
```
Orchestrator
  → The Doorman     (validate commit messages on the branch)
  → The Reviewer    (five-axis code review)
  → The Tester      (verify test coverage)
  → The Auditor     (security pass)
  → The Scribe      (generate PR description)
  → The Herald      (prepare release notes if merging to main)
```

Each member signals done → Orchestrator routes to next → human approves final output.

---

## Persistent Memory

The Society remembers across sessions:

- **Project scope** — conventions, rules, recurring patterns in this codebase
- **User scope** — preferences, feedback, workflow patterns
- **Session scope** — current task state, in-progress work

Memory is stored in `.agenthood/memory.json` and loaded at session start.
Members read from memory before acting and write to it after significant decisions.

In the Python runtime (Phase 2), memory is backed by a LangGraph Memory Store with
three namespaces — `project`, `session`, `user` — and synced to `.agenthood/memory.json`
via `MemoryBridge` so it remains human-readable outside the runtime.

---

## Runtime Implementation

The architecture described in this document is being progressively implemented in
[`runtime/`](../runtime/) as `agenthood-runtime` (Python 3.12+, DeepAgents + LangGraph).

| This doc | Implemented as |
|----------|---------------|
| Orchestrator | `runtime/agenthood_runtime/orchestrator/graph.py` (Phase 3) |
| Member subagents | `runtime/agenthood_runtime/members/specs.py` ✅ Phase 1 |
| Tool scoping | `SubAgent.tools` in specs.py ✅ Phase 1 |
| Permission profiles | `SubAgent.permissions` in specs.py ✅ Phase 1 |
| Persistent memory | `runtime/agenthood_runtime/memory/` (Phase 2) |
| Concurrency queue | `runtime/agenthood_runtime/orchestrator/` (Phase 3) |

The Markdown skill files in `members/` are never modified — they are loaded as-is
into each agent's system prompt via `SkillsMiddleware`.
