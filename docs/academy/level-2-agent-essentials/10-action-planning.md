# Action Planning

> *An agent that acts without planning is not autonomous. It is reckless.*

---

## What it is

<!-- TODO: Issue #122 — Level 2 article content -->

_This article is coming in v1.6.0. See [issue #122](https://github.com/fworks-tech/agenthood/issues/122)._

**Covers:** Structured planning before execution — how `PlanSkill` and `ArchitectAgent` generate explicit, reviewable plans before any code is written or action is taken.

---

## Why it matters in production

<!-- TODO: Issue #122 -->

---

## How Agenthood implements it

<!-- TODO: Issue #122 -->

**Maps to:** `src/skills/reasoning/PlanSkill.ts`, `src/agents/ArchitectAgent.ts` _(coming in v2.0.0 / v2.2.0)_

---

## Hands-on example

<!-- TODO: Issue #122 -->

---

## Further reading

- [ADR-005 — Orchestrator pattern](../../docs/adr/ADR-005-orchestrator-pattern.md)
- `src/skills/reasoning/PlanSkill.ts` — planning skill _(v2.2.0)_
- [Tree of Thoughts: Deliberate Problem Solving with Large Language Models](https://arxiv.org/abs/2305.10601)

---

## LinkedIn version

**Hook:** Autonomous agents that skip planning are not efficient. They are unpredictable.

**Why it matters:**
- A plan is an audit trail before the fact — you can review it before anything irreversible happens
- Human-in-the-loop checkpoints are only useful if there is a plan to checkpoint
- Agenthood's `ArchitectAgent` produces plans the Society can read, reject, and revise

**→** [Read the full article →](https://agenthood.flabs.tech/academy/level-2-agent-essentials/10-action-planning/)
