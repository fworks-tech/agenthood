# Multi-Step Reasoning

> *Asking an LLM to solve a complex problem in one shot is asking a surgeon to operate without prep. The Society preps.*

---

## What it is

Multi-step reasoning breaks a complex problem into intermediate steps before committing to an answer. Rather than asking the model to "fix this bug" and accepting the first reply, you have it reason about the bug, form a hypothesis, test it, and only then propose a fix.

Three patterns cover most of it. **Chain-of-Thought** (CoT) has the model write its reasoning before the answer, in the "think step by step" style. **ReAct** interleaves reasoning with actions: think, call a tool, observe, think again. **Tree-of-Thought** (ToT) explores several branches in parallel, scores them and follows the most promising one.

Cost and coverage separate them. CoT adds one reasoning pass. ReAct costs a tool call per action. ToT multiplies the passes by the number of branches, and only one branch produces the answer. Pick by task: CoT when the reasoning needs to be explicit, ReAct when the answer depends on information from outside the model, ToT when several approaches are viable and you want the best.

---

## Why it matters in production

Single-shot prompts fall apart on multi-step problems. Ask a model to "debug the failing test" and it will guess at the cause from the test name, having seen neither the output, the source nor the stack trace. The guess is plausible, which makes it worse than an obvious failure.

Single-shot reasoning is also invisible. When the answer is wrong there is no path to inspect, only a jump from question to answer. Multi-step reasoning leaves checkpoints: you can audit each step, and a wrong step becomes a local fix instead of another roll of the whole prompt.

The cost is real. Chain-of-thought roughly doubles the tokens per call, and tree-of-thought multiplies them by the branch count. The Society treats that as part of the price of a correct answer, which is still cheaper than shipping a wrong one.

---

## How Agenthood implements it

Agenthood implements ReAct as the default loop and CoT as a composable reasoning primitive. Both land in `src/reasoning/` (shipped in v2.0.0):

```typescript
import { ReActLoop, ChainOfThought } from 'agenthood';

// ReAct: the default agent loop
const reactLoop = new ReActLoop(agent);
const result = await reactLoop.execute(task);
// each iteration: reason -> act -> observe -> reason again

// Chain-of-Thought: explicit reasoning before action
const cot = new ChainOfThought({ steps: 3 });
const reasoning = await cot.reason({
  problem: 'Why does the test fail on line 42?',
  context: testOutput + sourceCode,
});
// reasoning = ['Hypothesis: null check missing', 'Verify: line 38 passes null', 'Conclusion: add guard at line 38']
```

`ReActLoop` is what `BaseAgent.run()` uses by default. `ChainOfThought` is available as a skill; you compose it into an agent's reasoning pipeline when a task benefits from explicit upfront thinking before actions begin. ToT-style branching (`TreeOfThought`) remains a planned enhancement for a future milestone.

---

## Hands-on example

```bash
# The Society's runtime uses ReAct by default
agenthood run debugger "the test suite is failing on test/auth.test.ts:42"
```

Watch the loop produce visible reasoning steps:

```
[think] The test expects auth() to reject empty tokens. Let me read the test.
[act]  read_file src/auth.ts
[see]  auth() returns true for any string, including empty.
[think] The guard is missing. I'll add a check for empty/falsy tokens.
[act]  edit_file src/auth.ts: add `if (!token) return false;`
[see]  File updated.
[think] Re-run the test to confirm the fix.
[act]  run_test test/auth.test.ts
[see]  PASS: 42 tests, 0 failures.
[done] Fixed: added empty-token guard in src/auth.ts:14
```

Each `[think]` line is a reasoning checkpoint. If the fix were wrong, you would know exactly which step failed.

---

## Further reading

- [ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629): the ReAct pattern paper
- [Chain-of-Thought Prompting Elicits Reasoning in Large Language Models](https://arxiv.org/abs/2201.11903): the CoT paper
- [`src/reasoning/ReActLoop.ts`](../../../src/reasoning/ReActLoop.ts): the reasoning loop (v2.0.0)


