# Agent System

> *The Society is not one agent. It is nine specialists who know when to call each other.*

---

## Overview

The Agenthood uses a **multi-agent architecture** where a central Orchestrator
coordinates nine specialized members. No member tries to do everything.
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

| Member | Tools Available |
|--------|----------------|
| The Scribe | git diff, git log, file read |
| The Architect | file read, file write (specs only), web search |
| The Reviewer | file read, git diff, diagnostics |
| The Tester | file read, file write (tests only), terminal (test runner) |
| The Debugger | file read, terminal, stack trace, debug tools |
| The Auditor | file read, dependency scanner, web search |
| The Herald | git log, git tag, file write (CHANGELOG only), GitHub API |
| The Librarian | file read, file write (docs only), web search |
| The Doorman | git hooks, CI config, file read, terminal (lint only) |

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
