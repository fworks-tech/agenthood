# API Wrappers

> Hardcoding to the OpenAI API is a technical debt time bomb. The Society abstracts the provider.

---

## What it is

An API Wrapper is a layer of abstraction between your application code and the external LLM provider's API (like OpenAI, Anthropic, or Google Gemini). Instead of calling `fetch('https://api.openai.com/v1/chat/completions')` directly throughout your codebase, you call a standardized internal method.

The wrapper handles provider-specific SDK logic, authentication, error handling, rate limiting, and response parsing, presenting a clean, unified contract to the rest of the application.

---

## Why it matters in production

The AI landscape changes weekly. Today's state-of-the-art model is tomorrow's legacy fallback. If your agent's logic is tightly coupled to Anthropic's SDK, migrating to a cheaper, faster local model requires a massive rewrite.

In production, API Wrappers prevent vendor lock-in. They also provide a central chokepoint to implement critical features like retry logic, telemetry logging, and fallback routing (e.g., if OpenAI goes down, automatically route to Gemini).

---

## How Agenthood implements it

Agenthood achieves this via the `ILLMProvider` interface. It defines a strict contract that all provider implementations (OpenAI, Anthropic, etc.) must adhere to.

This pattern will live in `src/llm/ILLMProvider.ts` (future milestone):

```typescript
// Planned for a future milestone
export interface ILLMProvider {
  complete(request: LLMRequest): Promise<LLMResponse>;
}

// Anthropic and OpenAI implementations both satisfy the interface
export class AnthropicProvider implements ILLMProvider { ... }
export class OpenAIProvider implements ILLMProvider { ... }
```

The Society does not care who generates the tokens, as long as the contract is respected.

---

## Hands-on example

Because of this abstraction, switching the active model for an agent is a configuration change, not a code change.

```bash
# Switch the runtime provider seamlessly
agenthood-run invoke the-scribe "Write a commit" --provider anthropic
agenthood-run invoke the-scribe "Write a commit" --provider openai
```

Or in TypeScript (future milestone):

```typescript
// The orchestrator doesn't care which provider is passed
const provider = config.useLocal ? new LocalProvider() : new AnthropicProvider();
const agent = new Agent(provider);
```

---

## Further reading

- [ADR-005 — Orchestrator pattern](../../docs/adr/ADR-005-orchestrator-pattern.md)
- [`src/llm/ILLMProvider.ts`](../../src/llm/ILLMProvider.ts) — source implementation (planned)
- [Martin Fowler: Gateway Pattern](https://martinfowler.com/articles/gateway-pattern.html) — the architectural basis for API wrappers

---

## LinkedIn version

**Hook:** Hardcoding to the OpenAI API is a technical debt time bomb. The Society abstracts the provider.

**Why it matters:**
- The AI landscape changes weekly; vendor lock-in is dangerous
- Abstractions allow seamless fallback if an API goes down
- You can route simple tasks to cheap models and complex tasks to expensive ones

**→** [Read the full article + implementation walkthrough →](https://fworks-tech.github.io/agenthood/academy/level-1-genai-rag-basics/08-api-wrappers/)
