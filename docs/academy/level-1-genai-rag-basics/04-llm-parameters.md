# LLM Parameters

> *Temperature is not a creativity dial. It is a precision dial. Miscalibrate it and your agent hallucinates with confidence.*

---

## What it is

<!-- TODO: Issue #121 — Level 1 article content -->

_This article is coming in v1.6.0. See [issue #121](https://github.com/fworks-tech/agenthood/issues/121)._

**Covers:** Temperature, top_p, frequency_penalty, max_tokens — what each parameter controls and how Agenthood's `LLMRequest` type exposes them with sane defaults per use case.

---

## Why it matters in production

<!-- TODO: Issue #121 -->

---

## How Agenthood implements it

<!-- TODO: Issue #121 -->

**Maps to:** `src/llm/types.ts` — `LLMRequest` type with per-provider parameter mapping

---

## Hands-on example

<!-- TODO: Issue #121 -->

---

## Further reading

- `src/llm/types.ts` — `LLMRequest` parameter definitions
- [OpenAI API reference — temperature](https://platform.openai.com/docs/api-reference/chat/create#chat-create-temperature)

---

## LinkedIn version

**Hook:** Setting temperature to 0.9 on a code-generation agent is like asking a surgeon to "be more creative."

**Why it matters:**
- Low temperature for factual/structured tasks; higher for creative synthesis
- max_tokens misconfigurations silently truncate responses mid-sentence
- Agenthood maps parameters consistently across 4 providers so you set them once

**→** [Read the full article →](https://fworks-tech.github.io/agenthood/academy/level-1-genai-rag-basics/04-llm-parameters/)
