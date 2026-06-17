# Multi-Step Reasoning

> *Asking an LLM to solve a complex problem in one shot is asking a surgeon to operate without prep. The Society preps.*

---

## What it is

Multi-step reasoning is the practice of breaking a complex problem into intermediate thinking steps before producing a final answer. Instead of asking the model "fix this bug" and accepting whatever comes back, you ask it to reason about the bug, form a hypothesis, test the hypothesis, and only then propose a fix.

The three patterns that matter are Chain-of-Thought (CoT), ReAct, and Tree-of-Thought (ToT). **Chain-of-Thought** asks the model to write out its reasoning explicitly before the answer — "let me think step by step." **ReAct** interleaves reasoning with actions: think, call a tool, observe the result, think again. **Tree-of-Thought** explores multiple reasoning branches in parallel, evaluates them, and pursues the most promising one.

The difference between them is cost and coverage. CoT is cheap — one extra reasoning pass. ReAct is moderate — each action is a tool call that costs tokens and time. ToT is expensive — multiple branches mean multiple reasoning passes, only one of which produces the final answer. You choose based on the task: CoT for problems that need a clear line of thinking, ReAct for problems that need real-world information, ToT for problems with multiple valid approaches where you want the best one.

---

## Why it matters in production

Single-shot prompts collapse on multi-step problems. Ask an LLM to "debug the failing test" in one shot and it will guess at the cause based on the test name, because it has not seen the test output, the source code, or the stack trace. The guess is plausible and wrong — the most dangerous kind of output.

The deeper problem is that single-shot reasoning is invisible. When the answer is wrong, you cannot tell *where* the reasoning went wrong because there was no reasoning — just a jump from question to answer. Multi-step reasoning makes the path inspectable. Each intermediate step is a checkpoint you can audit, and a wrong step is a localized problem you can fix instead of re-rolling the entire prompt.

The cost tradeoff is real but manageable. Chain-of-thought roughly doubles token cost per call. Tree-of-thought multiplies it by the number of branches. The Society's position is that this cost is the cost of correctness — and it is far cheaper than the cost of shipping a wrong answer to production.

---

## How Agenthood implements it

Agenthood implements ReAct as the default loop and CoT as a composable reasoning primitive. Both land in `src/reasoning/` (coming in v2.0.0):

```typescript
import { ReActLoop, ChainOfThought } from 'agenthood';

// ReAct — the default agent loop
const reactLoop = new ReActLoop(agent);
const result = await reactLoop.execute(task);
// each iteration: reason -> act -> observe -> reason again

// Chain-of-Thought — explicit reasoning before action
const cot = new ChainOfThought({ steps: 3 });
const reasoning = await cot.reason({
  problem: 'Why does the test fail on line 42?',
  context: testOutput + sourceCode,
});
// reasoning = ['Hypothesis: null check missing', 'Verify: line 38 passes null', 'Conclusion: add guard at line 38']
```

`ReActLoop` is what `BaseAgent.run()` uses by default. `ChainOfThought` is available as a skill — you compose it into an agent's reasoning pipeline when a task benefits from explicit upfront thinking before actions begin. ToT-style branching is on the roadmap for v2.5.0, exposed as a `TreeOfThought` primitive with a configurable branch factor.

---

## Hands-on example

```bash
# The Society's runtime uses ReAct by default
agenthood run the-debugger "the test suite is failing on test/auth.test.ts:42"
```

Watch the loop produce visible reasoning steps:

```
[think] The test expects auth() to reject empty tokens. Let me read the test.
[act]  read_file src/auth.ts
[see]  auth() returns true for any string, including empty.
[think] The guard is missing. I'll add a check for empty/falsy tokens.
[act]  edit_file src/auth.ts — add `if (!token) return false;`
[see]  File updated.
[think] Re-run the test to confirm the fix.
[act]  run_test test/auth.test.ts
[see]  PASS — 42 tests, 0 failures.
[done] Fixed: added empty-token guard in src/auth.ts:14
```

Each `[think]` line is a reasoning checkpoint. If the fix were wrong, you would know exactly which step failed.

---

## Further reading

- [ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629) — the ReAct pattern paper
- [Chain-of-Thought Prompting Elicits Reasoning in Large Language Models](https://arxiv.org/abs/2201.11903) — the CoT paper
- [`src/reasoning/ReActLoop.ts`](../../src/reasoning/ReActLoop.ts) — the reasoning loop (v2.0.0)

---

## LinkedIn version

**Hook:** LLMs fail on complex problems not because they are not smart enough, but because they are not given time to think.

**Why it matters:**
- Single-shot prompts collapse on multi-step problems — each step needs its own context
- Chain-of-thought doubles token cost; tree-of-thought multiplies it — you choose based on the task
- Agenthood's `ReActLoop` makes the reasoning explicit and observable — you see exactly where it went wrong

**→** [Read the full article →](https://agenthood.flabs.tech/academy/level-2-agent-essentials/07-multi-step-reasoning/)
