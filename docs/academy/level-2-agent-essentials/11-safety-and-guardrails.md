# Safety and Guardrails

> *Autonomous does not mean uncontrolled. The Society is autonomous because it is disciplined, not despite it.*

---

## What it is

Agent safety is the set of controls that stop an autonomous agent from taking an action it should not take, producing an output it should not produce, or consuming resources it should not consume. Without those controls, autonomy is a liability.

A complete safety system has three layers. **Risk scoring** evaluates each proposed action before it executes, asking whether it is destructive, reversible, and whether it touches shared state; anything high-risk is gated, paused or rejected. **Compute budgets** bound runaway reasoning: an agent that loops forever burns tokens, time and money, and the budget stops it. **Output validation** inspects the result before it reaches a user or a downstream system, looking for secrets, unverified claims and diffs that are not safe to apply.

Each layer catches a different failure. Risk scoring catches the agent that tries to `rm -rf` the build directory. Compute budgets catch the agent that gets stuck in a reasoning loop and burns $40 in tokens overnight. Output validation catches the agent that pastes an API key into a commit message. You need all three because no single layer sees all three failure modes.

---

## Why it matters in production

The failure modes below are not hypothetical; each one has happened to a team that shipped an agent without a gate.

An agent with write access deletes a file it judged irrelevant. The file was a migration script that runs in CI. The action was autonomous, fast and irreversible, and the only recourse is a restore from backup. Risk scoring gates destructive actions before they execute, not after.

An agent enters a reasoning loop and retries the same failed tool call 200 times overnight. The bill reaches $400 and the task is no closer to done. A thinking budget forces termination after N iterations, which turns an open-ended cost into a bounded one.

An agent reads an env file, answers correctly, and includes the secret in the answer. The answer is posted to a public PR. Output validation catches the secret before it ships; without it, the secret is in git history and has to be rotated.

---

## How Agenthood implements it

Three components, all in `src/core/` (shipped in v2.0.0):

```typescript
import { RiskManager, ThinkingBudget, SafetyGuard } from 'agenthood';

// Risk scoring: gates destructive actions before execution
const riskManager = new RiskManager({
  rules: [
    { pattern: /rm -rf|drop table|force push/i, action: 'block',  reason: 'destructive' },
    { pattern: /write_file|edit_file/i,         action: 'review', reason: 'mutating' },
    { pattern: /read_file|run_test/i,           action: 'allow',  reason: 'safe' },
  ],
});

// Thinking budget: prevents runaway reasoning loops
const budget = new ThinkingBudget({ maxSteps: 25, maxTokens: 50_000 });

// SafetyGuard: output validation before delivery
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

The agent's proposed actions pass through `RiskManager` before they execute, each reasoning step increments `ThinkingBudget` until the loop stops, and every output goes through `SafetyGuard` before it is returned or written to disk. The three layers are independent, composable, and configurable per agent.

---

## Hands-on example

```bash
# The Society's runtime applies all three layers automatically
npx agenthood run builder "clean up the build directory"
```

Watch the safety layers fire:

```
[think] I'll remove the build artifacts to clean up.
[act]  propose: rm -rf dist/
[risk] ⚠ BLOCKED: pattern matches 'rm -rf' (destructive)
[think] Rejected. I'll use the build tool's clean command instead.
[act]  propose: npm run clean
[risk] ✓ allowed: safe command
[see]  dist/ removed (47 files)
[think] Done. Generating summary.
[output] SafetyGuard: ✓ no secrets detected, ✓ no license issues
[done]  Cleaned 47 build artifacts from dist/ via `npm run clean`
```

The `rm -rf` was blocked before it ran, the agent picked a safe alternative, and the output was scanned before delivery. The user saw only the verified result.

---

## Further reading

- [`src/core/RiskManager.ts`](../../../src/core/RiskManager.ts): action risk scoring (v2.0.0)
- [`src/core/SafetyGuard.ts`](../../../src/core/SafetyGuard.ts): output validation before delivery (v2.0.0)
- [Constitutional AI: Harmlessness from AI Feedback](https://arxiv.org/abs/2212.08073): Anthropic's safety framework paper


