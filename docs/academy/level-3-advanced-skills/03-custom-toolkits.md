# Custom Toolkits

> *The Society's 14 skills are a starting point. Your domain has skills the Society has not written yet.*

---

## What it is

<!-- TODO: Issue #123 — Level 3 article content -->

_This article is coming in v1.6.0. See [issue #123](https://github.com/fworks-tech/agenthood/issues/123)._

**Covers:** Building and discovering custom skills — a complete `ISkill` implementation walkthrough, and how `SkillRegistry.discover()` loads skills dynamically so you drop a file and restart.

---

## Why it matters in production

<!-- TODO: Issue #123 -->

---

## How Agenthood implements it

<!-- TODO: Issue #123 -->

**Maps to:** `src/skills/ISkill.ts`, `src/skills/SkillRegistry.ts` — specifically `SkillRegistry.discover()` _(coming in v2.0.0)_

---

## Hands-on example

<!-- TODO: Issue #123 — must include a complete ISkill implementation walkthrough -->

```typescript
// TODO: Issue #123 — complete ISkill implementation example
import { ISkill, SkillResult } from 'agenthood';

class MyCustomSkill implements ISkill {
  name = 'my_custom_skill';
  description = 'Does something domain-specific that the Society does not cover.';
  inputSchema = { /* JSON Schema */ };

  async execute(input: unknown, context: unknown): Promise<SkillResult> {
    // ...
  }
}
```

---

## Further reading

- `src/skills/ISkill.ts` — the skill contract _(v2.0.0)_
- `src/skills/SkillRegistry.ts` — dynamic discovery _(v2.0.0)_

---

## LinkedIn version

**Hook:** Every domain has knowledge the Society has not encoded yet. `ISkill` is the interface that lets you encode it.

**Why it matters:**
- Custom skills integrate domain logic as first-class agent tools — not hardcoded side effects
- `SkillRegistry.discover()` finds skills at startup — no registration boilerplate
- Your custom skill becomes a Society-standard tool the moment it implements `ISkill`

**→** [Read the full article →](https://agenthood.flabs.tech/academy/level-3-advanced-skills/03-custom-toolkits/)
