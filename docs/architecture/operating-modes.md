# Operating Modes

> *Sometimes the Society acts. Sometimes it advises. It always knows which is appropriate.*

---

## Overview

The Agenthood operates in two distinct modes. The mode determines what a member
is allowed to do — not what it knows. In both modes, members have full context.
Only their *actions* are constrained.

---

## Agent Mode

**Full autonomous execution.**

In Agent Mode, members can:
- Create, edit, and delete files
- Execute terminal commands
- Run tests, linters, and build tools
- Interact with Git (branch, commit, push — with approval gates)
- Call external APIs and MCP-connected services
- Spawn other members for multi-step tasks

All file changes are surfaced through a **diff review system** before being applied.
The human sees exactly what changed, approves or rejects per-file, and the
member proceeds only with approved changes.

**When to use Agent Mode:**
- Implementing a feature from a spec
- Fixing a bug end-to-end
- Running a full review + fix cycle
- Shipping a release

**Approval gates in Agent Mode:**

| Action | Gate |
|--------|------|
| Edit existing files | Diff review |
| Create new files | Diff review |
| Delete files | Explicit confirmation |
| Git commit | Explicit confirmation |
| Git push | Explicit confirmation |
| Terminal commands | Depends on permission profile |

---

## Ask Mode

**Direct Q&A. No side effects.**

In Ask Mode, members can:
- Read files and analyze code
- Answer questions about the codebase
- Suggest changes (as text, not applied)
- Explain decisions, patterns, and tradeoffs
- Generate output for the human to apply manually

In Ask Mode, members **cannot**:
- Write or delete files
- Execute terminal commands
- Make Git operations
- Trigger other members autonomously

**When to use Ask Mode:**
- Understanding an unfamiliar part of the codebase
- Getting a review without applying changes
- Exploring options before committing to an approach
- Asking "what would The Architect do here?"

---

## Mode Switching

Modes are explicit — the human chooses the mode per session or per request.
A member never escalates from Ask to Agent autonomously.

If a member in Ask Mode determines that a task *requires* Agent Mode, it says so:

> *"This task requires file edits. Switch to Agent Mode to proceed, or I can describe the changes for you to apply manually."*

---

## Permission Profiles

Within Agent Mode, three permission profiles further constrain behavior:

| Profile | What it allows |
|---------|---------------|
| `Restricted` | Read-only tools only — effectively Ask Mode with structured output |
| `Standard` | All tools; dangerous terminal commands require approval; default |
| `Trusted` | All tools; file edits auto-approved; catastrophic commands still blocked |

**Catastrophic commands** are blocked universally regardless of profile:
`rm -rf /`, `mkfs`, `dd if=/dev/zero`, `DROP DATABASE`, `git push --force origin main`

---

## Context Assembly

In both modes, context is assembled from the same 10 sources before a member acts:

1. Active/selected file(s)
2. Explicitly `@mentioned` files
3. Hybrid search results (vector + keyword)
4. Web search results (if tool available)
5. Codebase architectural understanding
6. Project rules (`.agenthood/rules.md`)
7. Persistent memory (`.agenthood/memory.json`)
8. Active member skills
9. Conversation history
10. Question classification result

The difference between modes is not *what* is known — it is *what* is done with that knowledge.
