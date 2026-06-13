# Tool Integration

> *An LLM that can only talk cannot act. Tool integration is what separates a chatbot from an agent.*

---

## What it is

<!-- TODO: Issue #121 — Level 1 article content -->

_This article is coming in v1.6.0. See [issue #121](https://github.com/fworks-tech/agenthood/issues/121)._

**Covers:** How LLMs call tools (function calling / tool use), the `ISkill` interface that makes every Agenthood capability a first-class tool, and how `SkillRegistry` discovers and exposes them to the `ReActLoop`.

---

## Why it matters in production

<!-- TODO: Issue #121 -->

---

## How Agenthood implements it

<!-- TODO: Issue #121 -->

**Maps to:** `src/skills/ISkill.ts`, `src/skills/SkillRegistry.ts`, `src/reasoning/ReActLoop.ts` _(coming in v2.0.0)_

---

## Hands-on example

<!-- TODO: Issue #121 -->

---

## Further reading

- [ADR-004 — Specialized members over general agent](../../docs/adr/ADR-004-specialized-members-over-general-agent.md)
- `src/skills/ISkill.ts` — the skill contract _(v2.0.0)_
- [OpenAI Function Calling](https://platform.openai.com/docs/guides/function-calling) — the standard tool-use pattern

---

## LinkedIn version

**Hook:** A language model is a text transformer. A tool-calling agent is a software system. The upgrade from one to the other is `ISkill`.

**Why it matters:**
- Without tools, agents can only describe actions — they cannot take them
- Unstructured tool registries break when skills change; typed interfaces do not
- Agenthood's `SkillRegistry` gives every agent the same toolkit with zero configuration

**→** [Read the full article →](https://fworks-tech.github.io/agenthood/academy/level-1-genai-rag-basics/09-tool-integration/)
