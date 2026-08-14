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

The `EvalRunner` lives in `src/evals/EvalRunner.ts`. It runs an agent against every task in a suite, scores the four metrics through an `EvalJudge`, and returns a structured report. Three of the metrics (faithfulness, relevance, context_recall) are scored by an LLM-as-judge prompt; answer_correctness is scored with embedding cosine similarity so it costs no extra LLM calls. The `EpisodeLearner` (`src/evals/EpisodeLearner.ts`) is also shipped — it writes high-scoring eval results into `LongTermMemory` and reinforces `ResidualMemory` signals:

```typescript
import { EvalRunner, LLMJudge, loadEvalSuite } from 'agenthood';

const suite = loadEvalSuite('./evals/benchmarks/review-pr.json');
const judge = new LLMJudge(llm);
const runner = new EvalRunner((task) => runMember('the-reviewer', task), judge);

const report = await runner.run(suite, 'the-reviewer');

// report.aggregate = {
//   faithfulness:       0.87,
//   relevance:          0.94,
//   context_recall:     0.81,
//   answer_correctness: 0.92,
// }
```

The `BaselineComparator` compares every run against the stored baseline (`.agenthood/baselines/<member>.json`) and flags regressions — the eval command exits non-zero when a metric drops more than the threshold. The `EpisodeLearner` consumes the trace — which steps took the longest, which tool calls failed, which reasoning paths produced the wrong answer — and feeds it back into the agent's memory so the next run avoids the same detours.

---

## Hands-on example

```bash
# Eval suites run like tests; benchmark fixtures ship in evals/benchmarks/
npx agenthood eval the-reviewer --suite evals/benchmarks/review-pr.json --update-baseline
```

Expected output:

```
Eval Report — the-reviewer (review-pr)
  Suite: review-pr | Tasks: 3 | Timestamp: 2026-08-14T00:00:00.000Z

  Task                                     Faith    Relv.    CtxR.    Corr.   Status
  ---------------------------------------- -------- -------- -------- -------- ------------
  Review this diff: ...                    0.87     0.94     0.81     0.92    completed
  ...

  Aggregate: faithfulness 0.87, relevance 0.94, context_recall 0.81, answer_correctness 0.92

  No baseline at .agenthood/baselines/the-reviewer.json — run with --update-baseline to create one.
```

The regression flag is the point. A green test suite tells you nothing about answer quality. The eval command tells you exactly which metric dropped and on which case, and a later run exits non-zero when quality regresses against the stored baseline.

---

## Further reading

- [`src/evals/EpisodeLearner.ts`](../../../src/evals/EpisodeLearner.ts) — episode learner (shipped), writes eval results into memory
- [`src/evals/EvalRunner.ts`](../../../src/evals/EvalRunner.ts) — evaluation runner (shipped) with LLM-as-judge scoring
- [`src/evals/BaselineComparator.ts`](../../../src/evals/BaselineComparator.ts) — baseline comparison and regression gating
- [RAGAS: Automated Evaluation of Retrieval Augmented Generation](https://arxiv.org/abs/2309.15217) — the framework the four metrics derive from
- [Evaluating LLM Applications](https://eugeneyan.com/writing/evaluating-llm-applications/) — Eugene Yan on eval strategy


