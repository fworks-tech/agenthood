# Multi-Step Reasoning

> *Asking an LLM to solve a complex problem in one shot is asking a surgeon to operate without prep. The Society preps.*

---

## What it is

<!-- TODO: Issue #122 — Level 2 article content -->

_This article is coming in v1.6.0. See [issue #122](https://github.com/fworks-tech/agenthood/issues/122)._

**Covers:** ReAct, Chain-of-Thought, and Tree-of-Thought reasoning — and how Agenthood's `ReActLoop` and `ChainOfThought` implement them for agents that need to reason before acting.

---

## Why it matters in production

<!-- TODO: Issue #122 -->

---

## How Agenthood implements it

<!-- TODO: Issue #122 -->

**Maps to:** `src/reasoning/ReActLoop.ts`, `src/reasoning/ChainOfThought.ts` _(coming in v2.0.0)_

---

## Hands-on example

<!-- TODO: Issue #122 -->

---

## Further reading

- [ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629)
- [Chain-of-Thought Prompting Elicits Reasoning in Large Language Models](https://arxiv.org/abs/2201.11903)
- `src/reasoning/ReActLoop.ts` — the reasoning loop _(v2.0.0)_

---

## LinkedIn version

**Hook:** LLMs fail on complex problems not because they are not smart enough, but because they are not given time to think.

**Why it matters:**
- Single-shot prompts collapse on multi-step problems — each step needs its own context
- Chain-of-thought doubles token cost; tree-of-thought multiplies it — you choose based on the task
- Agenthood's `ReActLoop` makes the reasoning explicit and observable — you see exactly where it went wrong

**→** [Read the full article →](https://agenthood.flabs.tech/academy/level-2-agent-essentials/07-multi-step-reasoning/)
