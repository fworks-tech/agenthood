# Agent Workflows

> *A single agent is a specialist. A workflow is a team. Teams ship features; specialists write notes.*

---

## What it is

<!-- TODO: Issue #122 — Level 2 article content -->

_This article is coming in v1.6.0. See [issue #122](https://github.com/fworks-tech/agenthood/issues/122)._

**Covers:** Multi-step agent orchestration — how `WorkflowEngine` chains `AgentStep`, `ParallelStep`, and `HumanInLoopStep` into coherent processes that produce real software artifacts.

---

## Why it matters in production

<!-- TODO: Issue #122 -->

---

## How Agenthood implements it

<!-- TODO: Issue #122 -->

**Maps to:** `src/workflows/WorkflowEngine.ts` _(coming in v2.3.0)_

---

## Hands-on example

<!-- TODO: Issue #122 -->

---

## Further reading

- [ADR-005 — Orchestrator pattern over peer-to-peer](../../docs/adr/ADR-005-orchestrator-pattern.md)
- `src/workflows/WorkflowEngine.ts` — workflow orchestration _(v2.3.0)_
- [Patterns for Building LLM-based Systems & Products](https://eugeneyan.com/writing/llm-patterns/) — Eugene Yan

---

## LinkedIn version

**Hook:** Single agents are good at one thing. Workflows are good at shipping.

**Why it matters:**
- Sequential steps accumulate context; parallel steps multiply throughput
- Human-in-the-loop checkpoints prevent autonomous agents from going off-rails silently
- Agenthood's `WorkflowEngine` orchestrates both without peer-to-peer coordination chaos

**→** [Read the full article →](https://agenthood.flabs.tech/academy/level-2-agent-essentials/04-agent-workflows/)
