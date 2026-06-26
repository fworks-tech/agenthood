# Safety and Guardrails

> *Autonomous does not mean uncontrolled. The Society is autonomous because it is disciplined, not despite it.*

---

## What it is

Agent safety is the set of controls that prevent an autonomous agent from taking actions it should not take, producing outputs it should not produce, or consuming resources it should not consume. Autonomy without safety is not a feature — it is a liability waiting for a target.

Three layers make up a complete safety system. **Risk scoring** evaluates each proposed action before it executes: is this action destructive? Is it reversible? Does it affect shared state? A high-risk action is gated, paused, or rejected before it runs. **Compute budgets** prevent runaway reasoning: an agent that loops forever consumes tokens, time, and money, and a budget forces it to stop. **Output validation** inspects what the agent produces before it reaches the user or a downstream system: does the response contain secrets? Does it include unverified claims? Is the proposed diff actually safe to apply?

Each layer catches a different failure. Risk scoring catches the agent that tries to `rm -rf` the build directory. Compute budgets catch the agent that gets stuck in a reasoning loop and burns $40 in tokens overnight. Output validation catches the agent that pastes an API key into a commit message. You need all three because no single layer sees all three failure modes.

---

## Why it matters in production

Unguarded autonomous agents are not a feature. They are a liability. The failure modes are not hypothetical — they are the documented incidents of every team that shipped an agent without safety gates.

The risk-scored failure: an agent with write access to the filesystem deletes a file it judged irrelevant, and the file was a migration script that runs in CI. The action was autonomous, fast, and irreversible. Risk scoring gates destructive actions *before* they execute — not after, when the only recourse is a restore from backup.

The budget failure: an agent enters a reasoning loop, retrying the same failed tool call 200 times overnight. The bill is $400. The task is no closer to done. A thinking budget forces termination after N iterations, turning an open-ended cost into a bounded one.

The output failure: an agent produces a correct answer that includes a secret it read from an env file, and the answer is posted to a public PR. Output validation catches the secret before it ships. Without it, the secret is now in git history and must be rotated.

---

## How Agenthood implements it

Three components, all in `src/core/` (shipped in v2.0.0):

```typescript
import { RiskManager, ThinkingBudget, SafetyGuard } from 'agenthood';

// Risk scoring — gates destructive actions before execution
const riskManager = new RiskManager({
  rules: [
    { pattern: /rm -rf|drop table|force push/i, action: 'block',  reason: 'destructive' },
    { pattern: /write_file|edit_file/i,         action: 'review', reason: 'mutating' },
    { pattern: /read_file|run_test/i,           action: 'allow',  reason: 'safe' },
  ],
});

// Thinking budget — prevents runaway reasoning loops
const budget = new ThinkingBudget({ maxSteps: 25, maxTokens: 50_000 });

// SafetyGuard — output validation before delivery
const guard = new SafetyGuard({
  checks: [secretScanner, licenseChecker, hallucinationHeuristic],
});

// Composed into an agent
const agent = new DeveloperAgent({
  riskManager,
  thinkingBudget: budget,
  safetyGuard: guard,
});
```

Every action the agent proposes passes through `RiskManager` before it executes. Every reasoning step increments `ThinkingBudget`, and the loop terminates when the budget is exhausted. Every output passes through `SafetyGuard` before it is returned to the user or written to disk. The three layers are independent, composable, and each can be customized per agent.

---

## Hands-on example

```bash
# The Society's runtime applies all three layers automatically
npx agenthood run the-developer "clean up the build directory"
```

Watch the safety layers fire:

```
[think] I'll remove the build artifacts to clean up.
[act]  propose: rm -rf dist/
[risk] ⚠ BLOCKED — pattern matches 'rm -rf' (destructive)
[think] Rejected. I'll use the build tool's clean command instead.
[act]  propose: npm run clean
[risk] ✓ allowed — safe command
[see]  dist/ removed (47 files)
[think] Done. Generating summary.
[output] SafetyGuard: ✓ no secrets detected, ✓ no license issues
[done]  Cleaned 47 build artifacts from dist/ via `npm run clean`
```

The `rm -rf` was blocked before it ran. The agent adapted. The output was scanned before delivery. All three layers fired, and the user saw only the safe, verified result.

---

## Further reading

- [`src/core/RiskManager.ts`](../../src/core/RiskManager.ts) — action risk scoring (v2.0.0)
- [`src/core/SafetyGuard.ts`](../../src/core/SafetyGuard.ts) — output validation before delivery (v2.0.0)
- [Constitutional AI: Harmlessness from AI Feedback](https://arxiv.org/abs/2212.08073) — Anthropic's safety framework paper


