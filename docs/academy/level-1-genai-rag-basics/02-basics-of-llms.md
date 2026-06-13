# Basics of LLMs

> *You cannot debug what you do not understand. Know the model before you build on it.*

---

## What it is

<!-- TODO: Issue #121 — Level 1 article content -->

_This article is coming in v1.6.0. See [issue #121](https://github.com/fworks-tech/agenthood/issues/121)._

**Covers:** How LLMs work (tokens, context windows, inference), and how Agenthood abstracts the 4 providers behind one interface so your agents are not locked to any single model.

---

## Why it matters in production

<!-- TODO: Issue #121 -->

---

## How Agenthood implements it

<!-- TODO: Issue #121 -->

**Maps to:** `src/llm/ILLMProvider.ts` — 4 providers: Groq (default), Anthropic, OpenAI, Ollama

---

## Hands-on example

<!-- TODO: Issue #121 -->

---

## Further reading

- [ADR-009 — Groq as default free LLM provider](../../docs/adr/) _(coming in v2.0.0)_
- `src/llm/ILLMProvider.ts` — provider abstraction interface
- [How Large Language Models work](https://www.youtube.com/watch?v=5sLYAQS9sWQ) — Sebastian Raschka

---

## LinkedIn version

**Hook:** Most LLM tutorials skip the part where you learn what a context window actually is. Then you hit the limit in production.

**Why it matters:**
- Context windows are hard limits, not soft suggestions
- Token costs compound across thousands of requests
- Provider lock-in is a debt you pay when the API changes

**→** [Read the full article →](https://fworks-tech.github.io/agenthood/academy/level-1-genai-rag-basics/02-basics-of-llms/)
