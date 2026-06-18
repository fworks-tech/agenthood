# Multi-Agent Systems

> *Peer-to-peer coordination looks elegant on a diagram. In production, it becomes a deadlock.*

---

## What it is

A multi-agent system is a setup where more than one agent works on the same problem. The question is not whether to use multiple agents — real tasks need specialists — but how they coordinate. There are two patterns, and they produce wildly different systems.

**Peer-to-peer**: agents invoke each other directly. The Architect calls the Tester, the Tester calls the Developer, the Developer calls the Reviewer. Each agent decides, on its own, when to hand off. This looks elegant on a whiteboard because there is no central coordinator — the agents self-organize.

**Orchestrator-driven**: a central controller routes tasks to agents. The orchestrator decides which agent runs, in what order, and what context it receives. Agents do not call each other. They receive a task, execute it, return a result, and stop.

The difference shows up the moment something fails. In a peer-to-peer system, a failure in one agent propagates to every agent that called it, and the propagation path is invisible — you cannot tell which agent triggered which. In an orchestrator system, the failure is localized to one step, and the orchestrator's log shows exactly which step failed and why.

---

## Why it matters in production

Peer-to-peer multi-agent systems have a hidden property: every agent is also a point of failure for every other agent. When the Developer agent calls the Reviewer agent and the Reviewer hangs, the Developer hangs. When the Tester calls the Developer with malformed input and the Developer hallucinates, the Tester proceeds on bad output. The failure propagation graph is the full connection graph, and the full connection graph is unmanageable past three agents.

The second problem is context leakage. In a peer-to-peer system, agents pass their full context to whoever they call. The Reviewer receives the Architect's planning context, the Tester's test context, and the Developer's implementation context — all merged into one opaque blob. The Reviewer cannot tell which context is relevant, so it reasons over all of it, and the irrelevant parts actively confuse it.

The orchestrator pattern solves both. Each agent receives only the context the orchestrator explicitly assigns. The Reviewer gets the diff and the test results — not the Architect's planning notes. Failures are localized: if the Developer fails, the orchestrator retries or escalates; no other agent is affected. And the invocation graph is a linear log, not a tangled web. This is why ADR-005 chose orchestrator over peer-to-peer for the Society's 14 members.

---

## How Agenthood implements it

The orchestrator lives in `WorkflowEngine` (coming in v2.3.0) and is documented in ADR-005. Agents never invoke each other directly. The orchestrator routes, agents execute, results return:

```typescript
import { WorkflowEngine, AgentStep, ParallelStep } from 'agenthood';

// The orchestrator — not the agents — decides the execution graph
const pipeline = new WorkflowEngine()
  .step(new AgentStep('the-architect', { task: 'plan the feature' }))
  .step(new AgentStep('the-tester',    { task: 'write tests from the plan' }))
  .step(new AgentStep('the-developer', { task: 'implement against the tests' }))
  .step(new ParallelStep([
      new AgentStep('the-reviewer',  { task: 'review the diff' }),
      new AgentStep('the-auditor',   { task: 'audit dependencies' }),
  ]))
  .step(new AgentStep('the-scribe', { task: 'write the commit message' }));

const result = await pipeline.run();
```

Each `AgentStep` receives exactly the inputs the orchestrator provides — no agent sees another agent's internal context. `ParallelStep` runs independent agents concurrently and merges their outputs. The v2.0.0 phase (ADR-005 update) implements the orchestrator as a state graph with `interrupt_on` approval gates.

---

## Hands-on example

```bash
# The Steward routes a multi-member task through the orchestrator
agenthood run the-steward "ship: add OAuth2 login to the API"
```

The orchestrator log shows the linear invocation graph — no peer-to-peer tangle:

```
route  → the-architect (plan)
exec   → the-architect: "3 endpoints to add, 1 middleware to extend"
route  → the-tester (tests)
exec   → the-tester: "6 tests written — 3 happy path, 3 error cases"
route  → the-developer (implement)
exec   → the-developer: "OAuth2 middleware + 3 handlers implemented"
route  → parallel [the-reviewer, the-auditor]
exec   → the-reviewer: "approved, 1 nit"
exec   → the-auditor:  "no new vulnerabilities"
route  → the-scribe (commit)
exec   → the-scribe:  "feat(auth): add OAuth2 login to API"
done   → 5 members, 0 failures, 1 human approval gate
```

---

## Further reading

- [ADR-005 — Orchestrator pattern over peer-to-peer](../../adr/ADR-005-orchestrator-pattern.md) — the decision and its alternatives
- [`src/workflows/WorkflowEngine.ts`](../../src/workflows/WorkflowEngine.ts) — the orchestrator (v2.3.0)
- [AutoGen: Enabling Next-Gen LLM Applications via Multi-Agent Conversation](https://arxiv.org/abs/2308.08155) — the multi-agent paper whose peer-to-peer model ADR-005 rejected

---

## LinkedIn version

**Hook:** Multi-agent peer-to-peer systems have a hidden property: every agent is also a point of failure for every other agent.

**Why it matters:**
- Without a central orchestrator, failure propagation is unpredictable
- Parallel execution without coordination produces race conditions in shared state
- Agenthood's orchestrator pattern (ADR-005) is the reason the Society's 14 members do not step on each other

**→** [Read the full article →](https://agenthood.flabs.tech/academy/level-2-agent-essentials/08-multi-agent-systems/)
