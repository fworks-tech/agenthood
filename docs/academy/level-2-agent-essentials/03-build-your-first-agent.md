# Build Your First Agent

> *Reading about agents is not building agents. This is the article where you build one.*

---

## What it is

<!-- TODO: Issue #122 — Level 2 article content -->

_This article is coming in v1.6.0. See [issue #122](https://github.com/fworks-tech/agenthood/issues/122)._

**Covers:** Step-by-step implementation of a `DeveloperAgent` that extends `BaseAgent` — the complete working code example that proves you understand levels 1 and 2.

---

## Why it matters in production

<!-- TODO: Issue #122 -->

---

## How Agenthood implements it

<!-- TODO: Issue #122 -->

**Maps to:** `src/agents/base/BaseAgent.ts`, `src/agents/DeveloperAgent.ts` _(coming in v2.0.0 / v2.2.0)_

---

## Hands-on example

<!-- TODO: Issue #122 — This article's hands-on example must be a COMPLETE working code snippet -->

```typescript
// TODO: Issue #122 — complete DeveloperAgent implementation walkthrough
import { BaseAgent } from 'agenthood';

class DeveloperAgent extends BaseAgent {
  role = 'the-developer';
  // ...
}
```

---

## Further reading

- [ADR-005 — Orchestrator pattern](../../docs/adr/ADR-005-orchestrator-pattern.md)
- `src/agents/base/BaseAgent.ts` — the class to extend _(v2.0.0)_
- [Building agents with LLMs](https://lilianweng.github.io/posts/2023-06-23-agent/) — Lilian Weng's comprehensive breakdown

---

## LinkedIn version

**Hook:** The difference between a developer who understands agents and one who builds them is exactly one working code example.

**Why it matters:**
- `BaseAgent.run()` handles the loop; you implement the role
- A working first agent teaches you every integration point at once
- Agenthood's 14 members are proof the pattern works at scale

**→** [Read the full article →](https://agenthood.flabs.tech/academy/level-2-agent-essentials/03-build-your-first-agent/)
