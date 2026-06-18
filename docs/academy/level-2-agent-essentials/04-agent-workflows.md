# Agent Workflows

> *A single agent is a specialist. A workflow is a team. Teams ship features; specialists write notes.*

---

## What it is

An agent workflow is a structured sequence of agent invocations — sequential, parallel, or both — that produces a complete artifact. One agent writes the spec. Another writes the tests. A third implements the code. A fourth reviews it. The workflow chains them so the output of one step becomes the input of the next.

The building blocks of a workflow are step types. A sequential step runs one agent and passes its output forward. A parallel step runs multiple agents simultaneously and merges their results. A human-in-the-loop step pauses the workflow until a person approves, rejects, or edits the output before the next step runs. Compose these three and you can express any real software delivery process.

The key insight is that a workflow is not a conversation. It is a directed graph with explicit inputs, outputs, and dependencies. Each step knows what it receives and what it must produce. There is no implicit context bleeding between steps.

---

## Why it matters in production

Real tasks are not single-agent. "Ship this feature" involves planning, testing, implementing, reviewing, and documenting. Without a workflow engine, you glue these together with imperative scripts — and the glue becomes the part that breaks.

The failure mode is context loss. When one agent finishes and another starts, the second agent needs the *output* of the first, not the entire conversation history. Workflows enforce this boundary: each step receives exactly what the workflow definition says it should receive, nothing more. This is what makes steps reusable and workflows debuggable.

Human-in-the-loop checkpoints are the other non-negotiable. An autonomous workflow that merges PRs without a human review is a liability. The workflow engine must pause, present the proposed action, and wait for a decision. ADR-005 calls this the approval model — and it is the reason the Society's orchestrator pattern includes `interrupt_on` gates.

---

## How Agenthood implements it

The `WorkflowEngine` (coming in v2.3.0) lives in `src/workflows/WorkflowEngine.ts`. It executes a graph of typed steps, each with a defined input and output contract:

```typescript
import { WorkflowEngine, AgentStep, ParallelStep, HumanInLoopStep } from 'agenthood';

const workflow = new WorkflowEngine()
  .step(new AgentStep('the-architect', { task: 'plan the auth refactor' }))
  .step(new HumanInLoopStep({ gate: 'approve-plan' }))
  .step(new AgentStep('the-tester',    { task: 'write tests for the plan' }))
  .step(new ParallelStep([
      new AgentStep('the-developer', { task: 'implement the refactor' }),
      new AgentStep('the-librarian', { task: 'update the docs' }),
  ]))
  .step(new AgentStep('the-reviewer', { task: 'review the changes' }));

const result = await workflow.run();
```

Each step produces a typed output that the next step consumes. The `HumanInLoopStep` pauses execution and emits an approval request — the workflow does not advance until the gate is resolved. `ParallelStep` runs its children concurrently and merges results when all complete.

---

## Hands-on example

```bash
# Run a predefined Society workflow
agenthood run the-steward "ship: add rate limiting to the API middleware"
```

The Steward routes the task through the appropriate members: Architect plans, Tester writes tests, Developer implements, Reviewer reviews. Each step's output is logged:

```
[1/5] the-architect  → plan: 3 files to modify, 1 new dependency
[2/5] HUMAN GATE     → approve-plan: approved
[3/5] the-tester     → 4 tests written (2 unit, 2 integration)
[4/5] parallel:
        the-developer → implemented rateLimiter.ts
        the-librarian → updated README and ADR-011 stub
[5/5] the-reviewer   → approved, 0 blockers, 2 nits
```

---

## Further reading

- [ADR-005 — Orchestrator pattern over peer-to-peer](../../adr/ADR-005-orchestrator-pattern.md) — why workflows are orchestrated, not peer-to-peer
- [`src/workflows/WorkflowEngine.ts`](../../src/workflows/WorkflowEngine.ts) — workflow orchestration (v2.3.0)
- [Patterns for Building LLM-based Systems & Products](https://eugeneyan.com/writing/llm-patterns/) — Eugene Yan's pattern catalog

---

## LinkedIn version

**Hook:** Single agents are good at one thing. Workflows are good at shipping.

**Why it matters:**
- Sequential steps accumulate context; parallel steps multiply throughput
- Human-in-the-loop checkpoints prevent autonomous agents from going off-rails silently
- Agenthood's `WorkflowEngine` orchestrates both without peer-to-peer coordination chaos

**→** [Read the full article →](https://agenthood.flabs.tech/academy/level-2-agent-essentials/04-agent-workflows/)
