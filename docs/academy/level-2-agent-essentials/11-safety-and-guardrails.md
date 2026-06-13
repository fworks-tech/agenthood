# Safety and Guardrails

> *Autonomous does not mean uncontrolled. The Society is autonomous because it is disciplined, not despite it.*

---

## What it is

<!-- TODO: Issue #122 — Level 2 article content -->

_This article is coming in v1.6.0. See [issue #122](https://github.com/fworks-tech/agenthood/issues/122)._

**Covers:** Keeping agents controlled — `RiskManager` for action risk scoring, `ThinkingBudget` for compute limits, and `SafetyGuard` for output validation before any agent response reaches the user or downstream system.

---

## Why it matters in production

<!-- TODO: Issue #122 -->

---

## How Agenthood implements it

<!-- TODO: Issue #122 -->

**Maps to:** `src/core/RiskManager.ts`, `src/core/ThinkingBudget.ts`, `src/core/SafetyGuard.ts` _(coming in v2.0.0)_

---

## Hands-on example

<!-- TODO: Issue #122 -->

---

## Further reading

- `src/core/SafetyGuard.ts` — output validation before delivery _(v2.0.0)_
- [Constitutional AI: Harmlessness from AI Feedback](https://arxiv.org/abs/2212.08073) — Anthropic's safety framework paper

---

## LinkedIn version

**Hook:** Unguarded autonomous agents are not a feature. They are a liability.

**Why it matters:**
- Risk scoring gates destructive actions before they execute — not after
- Thinking budgets prevent runaway reasoning loops that consume tokens and time
- Agenthood's `SafetyGuard` is the last gate before any agent output reaches the world

**→** [Read the full article →](https://fworks-tech.github.io/agenthood/academy/level-2-agent-essentials/11-safety-and-guardrails/)
