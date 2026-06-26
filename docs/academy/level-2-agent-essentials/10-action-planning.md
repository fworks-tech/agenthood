# Action Planning

> *An agent that acts without planning is not autonomous. It is reckless.*

---

## What it is

Action planning is the step where an agent produces an explicit, reviewable plan before it takes any irreversible action. Instead of jumping straight from "fix the bug" to editing files, the agent first outputs a structured plan: which files it will touch, in what order, with what changes, and what tests it will run to verify each step.

A plan is not a paragraph of prose. It is a structured artifact — a list of steps, each with a target, an action, and a verification condition. "Edit `src/auth.ts` to add a null check at line 14, then run `auth.test.ts` and confirm 42 passing" is a plan step. "Make the auth more robust" is not.

The reason planning is a distinct step from reasoning is reviewability. A plan can be shown to a human before any action is taken. A reasoning trace cannot — it is already mid-execution. Planning inserts a checkpoint between thought and action where a human, or a downstream safety gate, can approve, reject, or revise before anything irreversible happens.

---

## Why it matters in production

Autonomous agents that skip planning are not efficient. They are unpredictable. An agent that starts editing files based on its first reasoning step has committed to a path before it has considered the alternatives. If the path is wrong, you discover it after the damage — a half-edited file, a broken test suite, a dependency removed that should not have been.

A plan is an audit trail before the fact. You can review it, reject it, or edit it before anything happens. This is the difference between "the agent did something I now have to undo" and "the agent proposed something I prevented." The first costs an hour of cleanup. The second costs five seconds of reading.

Human-in-the-loop checkpoints are only useful if there is a plan to checkpoint. An approval gate on an agent with no planning step is a rubber stamp — the human is approving an action that has already begun. ADR-005's approval model presumes that the orchestrator emits a plan before execution, and the `interrupt_on` gates exist to pause at that boundary.

---

## How Agenthood implements it

Two components are planned for planning: `PlanSkill` and `ArchitectAgent`, in `src/skills/reasoning/PlanSkill.ts` and `src/agents/ArchitectAgent.ts` (both not yet implemented):

```typescript
import { ArchitectAgent } from 'agenthood';

const architect = new ArchitectAgent();
const plan = await architect.plan({
  task: 'add rate limiting to the API middleware',
  codebase: projectIndex,
});

// plan = {
//   steps: [
//     { target: 'src/middleware/rateLimiter.ts', action: 'create', verify: 'file exists' },
//     { target: 'src/middleware/auth.ts',        action: 'edit',   verify: 'imports rateLimiter' },
//     { target: 'test/middleware.test.ts',       action: 'run',    verify: 'all tests pass' },
//   ],
//   risks: ['rateLimiter may need a shared state store — see ADR-011 stub'],
//   approvalGate: 'before-step-2',
// }
```

`PlanSkill` is the reasoning primitive that generates the plan structure. `ArchitectAgent` is the Society member that uses it — specialized for planning, with no implementation skills of its own. The plan's `approvalGate` field tells the orchestrator where to pause for human review. ADR-005 describes how the orchestrator consumes this plan and executes it step by step, stopping at each gate.

---

## Hands-on example

```bash
# The Architect produces a plan; nothing executes until approved
npx agenthood run the-architect "plan: add OAuth2 login to the API"
```

Output:

```
PLAN — add OAuth2 login to the API
────────────────────────────────────────────────────────
1. CREATE src/middleware/oauth2.ts        verify: file compiles
   └─ add OAuth2Strategy, token validation, error handling
2. EDIT   src/routes/login.ts             verify: route returns 200 on valid token
   └─ wire login handler to oauth2 middleware
3. CREATE test/oauth2.test.ts             verify: 6 tests pass
   └─ 3 happy path, 3 error cases (expired, invalid, missing)
4. RUN    npm test                        verify: full suite green
────────────────────────────────────────────────
RISKS:
- OAuth2 provider config needs env vars (OAUTH_CLIENT_ID, OAUTH_SECRET)
- Existing session middleware may conflict — verify in step 2
APPROVAL GATE: before step 1
────────────────────────────────────────────────
Approve plan? [y/n/edit]
```

The agent does not start editing until you approve. This is what "autonomous but controlled" means.

---

## Further reading

- [ADR-005 — Orchestrator pattern](../../adr/ADR-005-orchestrator-pattern.md) — how plans flow through the orchestrator with approval gates
- [`src/skills/reasoning/PlanSkill.ts`](../../src/skills/reasoning/PlanSkill.ts) — the planning skill (planned)
- [Tree of Thoughts: Deliberate Problem Solving with Large Language Models](https://arxiv.org/abs/2305.10601) — the planning paper this model draws from


