# Agent Evaluation

> *An agent you cannot measure is an agent you cannot improve. The Society measures everything.*

---

## What it is

<!-- TODO: Issue #122 — Level 2 article content -->

_This article is coming in v1.6.0. See [issue #122](https://github.com/fworks-tech/agenthood/issues/122)._

**Covers:** Why most RAG and agent systems fail without evaluation, Agenthood's four eval metrics (`EvalRunner`), and the feedback loop that connects evaluation scores back to agent behavior via `EpisodeLearner`.

---

## Why it matters in production

<!-- TODO: Issue #122 -->

---

## How Agenthood implements it

<!-- TODO: Issue #122 -->

**Maps to:** `src/evals/EvalRunner.ts` _(coming in v2.4.0)_

---

## Hands-on example

<!-- TODO: Issue #122 -->

---

## Further reading

- `src/evals/EvalRunner.ts` — evaluation runner _(v2.4.0)_
- [RAGAS: Automated Evaluation of Retrieval Augmented Generation](https://arxiv.org/abs/2309.15217) — evaluation framework paper

---

## LinkedIn version

**Hook:** You cannot improve what you do not measure. Most teams discover they needed evals after shipping something they cannot explain.

**Why it matters:**
- Answer quality degrades silently without measurement — you find out in production
- The four metrics (faithfulness, relevance, context recall, answer correctness) catch different failure modes
- Agenthood's `EvalRunner` closes the loop: eval scores feed `EpisodeLearner` which feeds future behavior

**→** [Read the full article →](https://fworks-tech.github.io/agenthood/academy/level-2-agent-essentials/06-agent-evaluation/)
