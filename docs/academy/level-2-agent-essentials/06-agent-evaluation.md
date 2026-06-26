# Agent Evaluation

> *An agent you cannot measure is an agent you cannot improve. The Society measures everything.*

---

## What it is

Agent evaluation is the discipline of measuring how well an agent performs — not once, but continuously, across every task it runs. It is the feedback loop that turns "it seems to work" into "it scored 0.87 on faithfulness and 0.92 on answer correctness, up from 0.71 and 0.78 last week."

Evaluation for agents extends RAG evaluation. A RAG system is judged on whether the retrieved context was relevant and whether the generated answer was faithful to it. An agent adds a third dimension: did the *actions* it took — the tool calls, the file edits, the loop iterations — move toward the goal or away from it? An agent that produces a correct answer through a broken reasoning path is a liability, because the path will break differently next time.

The four metrics the Society tracks are faithfulness (is the answer grounded in retrieved context, not hallucinated), relevance (is the retrieved context actually about the question), context recall (did retrieval find the relevant information that exists), and answer correctness (is the final answer right). Each catches a different failure mode, and all four are needed because no single metric catches them all.

---

## Why it matters in production

Answer quality degrades silently. A RAG pipeline that scored well in the demo drifts as the document corpus changes, as the embedding model is updated, as the chunking strategy is tweaked. Without continuous evaluation, you discover the degradation in production — when a user reports a wrong answer and you have no data to explain why.

The same is true for agents, amplified. An agent that loops one extra iteration on 5% of tasks adds cost and latency that you will never notice without measurement. An agent that calls the wrong tool 3% of the time produces failures that look like flaky tests. Evaluation makes the invisible visible: the `EvalRunner` runs the agent against a fixed suite, scores the four metrics, and compares to the baseline.

The loop closes when eval scores feed back into agent behavior. An agent that scores low on faithfulness needs tighter retrieval grounding. An agent that scores low on answer correctness needs better reasoning or better tools. Agenthood's `EpisodeLearner` consumes the eval trace and adjusts future behavior — this is how agents improve instead of merely persisting.

---

## How Agenthood implements it

The `EvalRunner` (planned — `src/evals/` does not exist yet) will live in `src/evals/EvalRunner.ts`. It runs an agent against a suite, scores the four metrics, and returns a structured report:

```typescript
import { EvalRunner } from 'agenthood';

const runner = new EvalRunner({
  agent: new DeveloperAgent(),
  suite: './evals/developer-agent-suite.json',
  metrics: ['faithfulness', 'relevance', 'context_recall', 'answer_correctness'],
});

const report = await runner.run();

// report.scores = {
//   faithfulness:       0.87,
//   relevance:          0.94,
//   context_recall:     0.81,
//   answer_correctness: 0.92,
// }
// report.regression = { faithfulness: +0.04, answer_correctness: +0.08 }
```

The `EvalRunner` compares every run to the stored baseline and flags regressions. The `EpisodeLearner` consumes the trace — which steps took the longest, which tool calls failed, which reasoning paths produced the wrong answer — and feeds it back into the agent's memory so the next run avoids the same detours.

---

## Hands-on example

```bash
# Eval suites run like tests
npx agenthood eval the-developer --suite ./evals/developer-agent-suite.json
```

Expected output:

```
Eval Suite: developer-agent-suite (12 cases)
─────────────────────────────────────────────
faithfulness         0.87   (+0.04 vs baseline)
relevance            0.94   (+0.01)
context_recall       0.81   (-0.02)  ⚠ regression
answer_correctness   0.92   (+0.08)
─────────────────────────────────────────────
2 cases regressed on context_recall — see trace.
```

The regression flag is the point. A green test suite tells you nothing about answer quality. The `EvalRunner` tells you exactly which metric dropped and on which case.

---

## Further reading

- [`src/evals/EvalRunner.ts`](../../../src/evals/EvalRunner.ts) — evaluation runner (planned — `src/evals/` does not exist yet)
- [RAGAS: Automated Evaluation of Retrieval Augmented Generation](https://arxiv.org/abs/2309.15217) — the framework the four metrics derive from
- [Evaluating LLM Applications](https://eugeneyan.com/writing/evaluating-llm-applications/) — Eugene Yan on eval strategy


