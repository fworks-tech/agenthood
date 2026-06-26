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

Two components handle autonomy: `GoalChain` in `src/workflows/GoalChain.ts` and the Rituals layer (both planned — `src/workflows/` does not exist yet):

```typescript
import { GoalChain } from 'agenthood';

// A persistent goal that resumes across sessions
const migration = new GoalChain({
  goal: 'Migrate auth from session tokens to OAuth2',
  steps: [
    { id: 'research',  status: 'done',    output: 'OAuth2 flow documented' },
    { id: 'endpoints', status: 'done',    output: '3 endpoints identified' },
    { id: 'middleware', status: 'in_progress' },
    { id: 'tests',     status: 'pending' },
    { id: 'cutover',   status: 'pending' },
  ],
});

// Each run resumes from the last in_progress step
const result = await migration.advance();
// result.nextStep = 'middleware'
// result.progress = '2 of 5 steps complete'
```

Rituals are scheduled automations — a YAML manifest that binds a schedule to a member:

```yaml
# rituals/morning-briefing.yml
schedule: '0 8 * * *'      # 8am daily
member: the-herald
task: 'summarize overnight CI runs, open PRs, and stale issues'
output: slack:#engineering
```

```yaml
# rituals/watchman.yml
trigger: on_test_failure
member: the-debugger
task: 'read the failing test, propose a fix, post to #engineering'
output: slack:#engineering
```

Rituals are stateless between runs; `GoalChain` is stateful. The two compose: a ritual can advance a goal chain on a schedule.

---

## Hands-on example

```bash
# Once the v2 runtime ships, rituals run via the Society's scheduler
npx agenthood ritual run morning-briefing
npx agenthood ritual list                     # see all scheduled rituals
npx agenthood goal advance auth-migration     # advance a goal chain manually
```

Expected output from the morning briefing ritual:

```
RITUAL: morning-briefing  (08:00 local)
─────────────────────────────────────────────────
MEMBER: the-herald
TASK:   summarize overnight CI runs, open PRs, stale issues
─────────────────────────────────────────────────
CI:     3 runs overnight, 1 failure (test/auth.test.ts:42)
PRs:    2 open, 1 awaiting review > 24h (#181)
ISSUES: 4 stale (no activity 7+ days)
─────────────────────────────────────────────────
→ posted to #engineering
→ next run: tomorrow 08:00
```

The briefing appeared in Slack at 8am without anyone typing a query. That is what autonomy looks like in production.

---

## Further reading

- [`src/workflows/GoalChain.ts`](../../src/workflows/GoalChain.ts) — persistent multi-session goal tracking (planned)
- [Rituals layer](../../rituals/) — scheduled automation manifests (planned)
- [The Little Manual of API Design](https://web.archive.org/web/20240421073800/https://apisyouwonthate.com/books/the-little-manual-of-api-design) — design principles for durable integration surfaces


