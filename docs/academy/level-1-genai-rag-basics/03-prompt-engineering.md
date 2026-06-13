# Prompt Engineering

> *A vague prompt is a vague contract. The Society does not accept vague contracts.*

---

## What it is

<!-- TODO: Issue #121 — Level 1 article content -->

_This article is coming in v1.6.0. See [issue #121](https://github.com/fworks-tech/agenthood/issues/121)._

**Covers:** Writing prompts that produce consistent, structured outputs — and how Agenthood's `PromptBuilder` and the 14 member `.md` files codify this into reusable templates.

---

## Why it matters in production

<!-- TODO: Issue #121 -->

---

## How Agenthood implements it

<!-- TODO: Issue #121 -->

**Maps to:** `src/prompts/PromptBuilder.ts`, `members/the-*/the-*.md` — each member file is a structured prompt template

---

## Hands-on example

<!-- TODO: Issue #121 -->

---

## Further reading

- [ADR-001 — Markdown skills over code agents](../../docs/adr/ADR-001-markdown-skills-over-code-agents.md)
- `members/the-scribe/the-scribe.md` — example of a structured member prompt
- [Prompt Engineering Guide](https://www.promptingguide.ai/) — comprehensive reference

---

## LinkedIn version

**Hook:** Every inconsistent agent output traces back to an inconsistent prompt. The Society codifies prompts so they do not drift.

**Why it matters:**
- Inconsistent prompts produce inconsistent behavior — at scale, that is a bug
- Structured templates make prompt failures reproducible and fixable
- The 14 Agenthood members are 14 battle-tested prompt templates ready to ship

**→** [Read the full article →](https://fworks-tech.github.io/agenthood/academy/level-1-genai-rag-basics/03-prompt-engineering/)
