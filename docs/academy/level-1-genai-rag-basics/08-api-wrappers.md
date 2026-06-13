# API Wrappers

> *The LLM you use today is not the LLM you will use in six months. Abstract early.*

---

## What it is

<!-- TODO: Issue #121 — Level 1 article content -->

_This article is coming in v1.6.0. See [issue #121](https://github.com/fworks-tech/agenthood/issues/121)._

**Covers:** Why LLM client abstractions matter, what makes a good provider interface, and how `ILLMProvider` lets you switch between Groq, Anthropic, OpenAI, and Ollama without changing a single line of agent code.

---

## Why it matters in production

<!-- TODO: Issue #121 -->

---

## How Agenthood implements it

<!-- TODO: Issue #121 -->

**Maps to:** `src/llm/ILLMProvider.ts` — the abstraction; `src/llm/providers/` — 4 concrete implementations _(coming in v2.0.0)_

---

## Hands-on example

<!-- TODO: Issue #121 -->

---

## Further reading

- [ADR-009 — Groq as default free LLM provider](../../docs/adr/) _(coming in v2.0.0)_
- `src/llm/ILLMProvider.ts` — provider interface _(v2.0.0)_
- [OpenAI API Compatibility](https://platform.openai.com/docs/api-reference) — why most providers implement this spec

---

## LinkedIn version

**Hook:** Building directly on one LLM provider API is a bet that provider will still exist, stay affordable, and never change its interface. That is three bets, each of which has already been lost by someone.

**Why it matters:**
- Provider APIs change — abstractions insulate you from the change
- Cost optimization requires routing across providers — locked-in code cannot route
- Agenthood's `ILLMProvider` is the contract; the provider is the plug

**→** [Read the full article →](https://fworks-tech.github.io/agenthood/academy/level-1-genai-rag-basics/08-api-wrappers/)
