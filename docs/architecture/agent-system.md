# Agent System

> *The Society is not one agent. It is specialists who know when to call each other.*

---

## Overview

The Agenthood uses a **multi-agent architecture** where a central Orchestrator
coordinates all specialized members. No member tries to do everything.
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
implemented in [`src/members/MemberRegistry.ts`](../src/members/MemberRegistry.ts).

| Member | Permission Profile | Key Tools |
|--------|-------------------|-----------|
| The Scribe | standard | file.write, file.edit, git.*, terminal.run |
| The Architect | standard | file.write, file.edit, git.*, terminal.run |
| The Builder | standard | file.write, file.edit, git.*, terminal.run |
| The Reviewer | restricted | file.read, file.search, memory.*, tasks.* |
| The Tester | standard | file.write, file.edit, git.*, terminal.run |
| The Debugger | standard | file.write, file.edit, git.*, terminal.run |
| The Auditor | restricted | file.read, file.search, memory.*, tasks.* |
| The Herald | standard | file.write, file.edit, git.*, terminal.run |
| The Librarian | standard | file.write, file.edit, git.*, terminal.run |
| The Doorman | restricted | file.read, file.search, memory.*, tasks.* |
| The Oracle | restricted | file.read, file.search, memory.*, tasks.* |
| The Envoy | restricted | file.read, file.search, memory.*, tasks.* |
| The Sentinel | restricted | file.read, file.search, memory.*, tasks.* |
| The Warden | restricted | file.read, file.search, memory.*, tasks.* |
| The Strategist | restricted | file.read, file.search, memory.*, tasks.* |
| The Steward | restricted | file.read, file.search, memory.*, tasks.* |
| The Operator | restricted | file.read, file.search, memory.*, tasks.* |
| The Mailman | standard | file.write, file.edit, git.*, terminal.run |
| The Inspector | standard | file.write, file.edit, git.*, terminal.run |

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

Memory is backed by a tiered store: LanceDB for vector storage (`.agenthood/memory/`), ResidualMemory (`.agenthood/residual.json`), KnowledgeGraphStore (`.agenthood/society-graph.json`), and ShortTermMemory (in-memory ring buffer). Multiple namespaces — `shortTerm`, `longTerm`, `episodic`, `project` — keep concerns separated.

On top of the tiers sit the decision and provenance records. Every member run
writes one entry to the decision log (`.agenthood/decisions/`) and one to the
provenance store (`.agenthood/provenance/`), linked by the run's
`executionId`. Decisions connect with causal edges (`CAUSED`, `INFLUENCED`,
`PRECEDENT_FOR`) in `edges.json`, and the provenance chain is tamper-evident
(SHA-256 hash chain, `verifyChain()`). See
[decision-intelligence.md](decision-intelligence.md).

---

## Runtime Implementation

The architecture described in this document is implemented as a TypeScript CLI in
this repo (`src/`), per [ADR-008](../adr/ADR-008-typescript-runtime-over-python.md).

| This doc | Implemented as | Status |
|----------|----------------|--------|
| Members (skill files) | `skills/<name>/SKILL.md` | ✅ Shipped |
| Member subagent specs (tools, permissions) | `src/members/MemberRegistry.ts` | ✅ v2.0.0 |
| Tool scoping per member | `MemberSpec.tools` in `MemberRegistry` | ✅ v2.0.0 |
| Permission profiles | `MemberSpec.permissions` in `MemberRegistry` | ✅ v2.0.0 |
| Per-member preferred LLM provider | `MemberSpec.preferredProvider` | ✅ v2.0.0 |
| ReAct loop | `src/reasoning/ReActLoop.ts` | ✅ Shipped |
| BaseAgent | `src/agents/base/BaseAgent.ts` | ✅ Shipped |
| Concurrency queue | `src/core/ConcurrencyQueue.ts` | ✅ v2.0.0 |
| Safety caps | `src/core/SafetyGuard.ts` | ✅ v2.0.0 |
| Provider failover + circuit breaker | `src/llm/ProviderFailover.ts` | ✅ v2.0.0 |
| Persistent memory (IMemoryStore, ResidualMemory, InMemoryStore, VectorStore, ShortTerm, LongTerm, Episodic, Project) | `src/memory/` | ✅ Shipped |
| Decision intelligence (DecisionLog + causal chains, ProvenanceStore, DecisionSearch, GraphSnapshot) | `src/memory/` | ✅ ADR-015 |
| RAG pipeline (ChunkStrategy (FixedSize + MarkdownHierarchical), Indexer, Retriever, AgenticRAG, TreeSitterParser, ProjectIngestion) | `src/rag/` | ✅ Shipped |
| Society index (members, ADRs, conventions → KGS + VectorStore) | `src/project/SocietyIndexer.ts` | ✅ Shipped |
| MemberOrchestrator Phase 1 — detection | `src/reasoning/MemberOrchestrator.ts` | ✅ v2.6.0 |
| Orchestrator (event bus, multi-step handoff) | `src/orchestrator/` | 📋 Planned — Phase 3 |
| Member → Member direct handoff (today) | `SubagentTaskSkill` | ✅ Shipped (no bus) |

The Markdown skill files in `skills/` are never modified — each is parsed at runtime
by `MemberRegistry` and used as the system prompt for the corresponding `BaseAgent`.
