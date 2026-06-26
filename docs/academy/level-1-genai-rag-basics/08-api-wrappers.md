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

Agenthood achieves this via the `ILLMProvider` interface in `src/llm/ILLMProvider.ts`.
It defines a strict contract that all four provider implementations (Anthropic, Groq,
OpenAI, Ollama) adhere to:

```typescript
export interface ILLMProvider {
  complete(request: LLMRequest): Promise<LLMResponse>
  stream(request: LLMRequest): Promise<AsyncGenerator<LLMChunk>>
  embed(text: string): Promise<number[]>
  setModel(model: string): void
  getContextWindow(): number
}

export class AnthropicProvider implements ILLMProvider { ... }
export class GroqProvider implements ILLMProvider { ... }
export class OpenAIProvider implements ILLMProvider { ... }
export class OllamaProvider implements ILLMProvider { ... }
```

The `ProviderChain` wraps multiple providers with failover logic:

```typescript
const chain = new ProviderChain(
  [anthropicProvider, groqProvider],
  ['anthropic', 'groq'],
  { failureThreshold: 1, cooldownMs: 30_000 },
  new Map([['anthropic', ['sonnet', 'haiku']]])
)
```

The Society does not care who generates the tokens, as long as the contract is respected.

---

## Hands-on example

Because of this abstraction, switching the active provider for an agent is a configuration change, not a code change.

```bash
# Switch the runtime provider seamlessly
npx agenthood run the-scribe "Write a commit" --provider anthropic
npx agenthood run the-scribe "Write a commit" --provider groq
```

Or in TypeScript:

```typescript
const router = LLMRouter.fromConfig(config)
const chain = LLMRouter.createForMember('the-scribe', config)
const response = await chain.complete({ messages: [...] })
```

---

## Further reading

- [ADR-005 — Orchestrator pattern](../../adr/ADR-005-orchestrator-pattern.md)
- [`src/llm/ILLMProvider.ts`](../../../src/llm/ILLMProvider.ts) — source implementation
- [`src/llm/ProviderFailover.ts`](../../../src/llm/ProviderFailover.ts) — failover chain
- [architecture/provider-failover.md](../../../architecture/provider-failover.md) — architecture doc
- [Martin Fowler: Gateway Pattern](https://martinfowler.com/articles/gateway-pattern.html) — the architectural basis for API wrappers


