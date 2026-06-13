# Autonomous Loops

> *An agent that runs only when asked is a tool. An agent that runs when needed is an engineer.*

---

## What it is

<!-- TODO: Issue #123 — Level 3 article content -->

_This article is coming in v1.6.0. See [issue #123](https://github.com/fworks-tech/agenthood/issues/123)._

**Covers:** Agents that run without being asked — Agenthood's `GoalChain` for persistent multi-session goals and the Rituals layer for scheduled automations (morning-briefing, watchman, inspection).

---

## Why it matters in production

<!-- TODO: Issue #123 -->

---

## How Agenthood implements it

<!-- TODO: Issue #123 -->

**Maps to:** `src/workflows/GoalChain.ts` _(coming in v2.3.0)_, `rituals/` — scheduled automations

---

## Hands-on example

<!-- TODO: Issue #123 -->

---

## Further reading

- [`rituals/`](../../rituals/) — Agenthood's scheduled automation layer
- `src/workflows/GoalChain.ts` — persistent goal tracking _(v2.3.0)_

---

## LinkedIn version

**Hook:** The agents that deliver value in production are not the ones you prompt. They are the ones that run at 8am without you.

**Why it matters:**
- Goals that span multiple sessions need persistence — context windows do not persist
- Rituals fire on schedule; `GoalChain` resumes where the last session ended
- The Society's watchman ritual catches problems before your standup does

**→** [Read the full article →](https://fworks-tech.github.io/agenthood/academy/level-3-advanced-skills/02-autonomous-loops/)
