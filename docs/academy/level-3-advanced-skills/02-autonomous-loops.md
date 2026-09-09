# Autonomous Loops

> *An agent that runs only when asked is a tool. An agent that runs when needed is an engineer.*

---

## What it is

An autonomous loop is a mechanism that runs an agent on a schedule or a trigger — without a human prompting it each time. The morning briefing agent that runs at 8am. The watchman agent that runs when a test fails in CI. The inspection agent that runs when a dependency is published. These are not chat interactions. They are background processes that keep a system healthy while you do other things.

There are two flavors, and conflating them produces brittle systems. **Scheduled rituals** fire on a clock — every morning, every hour, every Monday. They are cron for agents. **Goal chains** pursue a long-running objective across many sessions — an agent that is "working on migrating the auth system" resumes where it left off each time it runs, until the goal is complete. Rituals are stateless between runs (each run starts fresh). Goal chains are stateful (each run loads prior progress).

The key architectural property is persistence. A context window does not persist. An agent that runs at 8am cannot remember what it concluded at 8am yesterday unless that conclusion was written to memory. Autonomous loops only work when the agent has the memory tiers from Level 2 article 05 — episodic memory for past runs, project memory for codebase state, long-term memory for persistent goals.

---

## Why it matters in production

The agents that deliver value in production are not the ones you prompt. They are the ones that run at 8am without you. The difference between a demo and a deployed agent is whether someone has to type a query for it to work.

The watchman ritual is the clearest example. A scheduled agent that runs the test suite, inspects the results, and posts a summary to Slack every morning catches regressions before your standup does. Without it, a broken build sits unnoticed until a human runs the tests — which might be hours or days, depending on the team's cadence. The ritual collapses the detection-to-awareness gap from "whenever someone checks" to "the next morning at 8am."

Goal chains solve the other production problem: long tasks that do not fit in one session. "Migrate the auth system from session tokens to OAuth2" is not a one-prompt task. It is a multi-day objective with dozens of steps. A goal chain persists the objective, tracks completed steps, and resumes on the next run — turning a project that would require a human project manager into a self-tracking agent workflow.

---

## How Agenthood implements it

Two components handle autonomy: `GoalChain` (shipped — `src/workflows/GoalChain.ts`) and the Rituals layer (planned — scheduled automation manifests, not yet implemented):

```typescript
import { GoalChain } from 'agenthood'

// A persistent goal, stored in long-term memory and resumed across sessions
const chain = new GoalChain(longTermMemory)
const goal = await chain.create('Migrate auth from session tokens to OAuth2', '#142')

const docs = await chain.addSubGoal(goal.id, { description: 'Document the OAuth2 flow' })
await chain.addSubGoal(goal.id, { description: 'Map the auth endpoints' })
await chain.updateStatus(goal.id, docs.id, 'completed')

// The next run picks up where this one left off
const next = await chain.resume(goal.id)
// next = { description: 'Map the auth endpoints', status: 'pending' } | undefined
```

Rituals are scheduled automations — a markdown manifest in `docs/rituals/` that binds a schedule to a member:

```markdown
<!-- docs/rituals/morning-briefing.md -->
---
name: morning-briefing
schedule: '0 8 * * 1-5'   # weekdays, 8am
priority: SCHEDULED
member: the-herald
description: Daily 8am standup generated from git activity, open PRs, and idle work detection.
---
```

```markdown
<!-- docs/rituals/the-watchman.md -->
---
name: the-watchman
schedule: '0 */2 * * *'   # every 2 hours
priority: BACKGROUND
member: the-doorman
description: Every 2 hours, checks for uncommitted changes sitting idle and branches drifting from main.
---
```

Rituals are stateless between runs; `GoalChain` is stateful. The two are designed to compose: a ritual can advance a goal chain on a schedule.

---

## Hands-on example

Rituals are declared in `docs/rituals/` and run via the CLI:

```bash
npx agenthood ritual list
npx agenthood ritual run morning-briefing
npx agenthood ritual run the-inspection
```

`ritual list` prints every manifest with its schedule and bound member; `ritual run <name>` resolves the member from the manifest and points its task at the steps and report format defined there. The member produces the report in the manifest's format and every run records a decision plus a provenance entry in `.agenthood/` (ADR-015).

In CI the same manifests run on their declared cron schedules (`.github/workflows/rituals.yml`) — the Morning Briefing arriving at 8am without anyone typing a query is the goal state. A parity test pins the workflow's schedules to the manifest frontmatter so the two cannot drift.

---

## Further reading

- [`src/workflows/GoalChain.ts`](../../../src/workflows/GoalChain.ts) — persistent multi-session goal tracking (shipped)
- [Rituals layer](../../rituals/) — scheduled automation manifests (with scheduler + `ritual run`)
- [The Little Manual of API Design](https://web.archive.org/web/20240421073800/https://apisyouwonthate.com/books/the-little-manual-of-api-design) — design principles for durable integration surfaces


