# LLM Parameters

> If you leave `temperature` at its default, you are surrendering control of your application's entropy.

---

## What it is

LLM parameters are the configuration knobs you pass to the API to alter how the model selects the next token. The most critical parameters are:

- **Temperature:** Controls randomness. `0.0` means strictly deterministic (always picking the highest probability token); `1.0` allows more creative, varied choices.
- **Top P (Nucleus Sampling):** Restricts token selection to a subset of tokens whose cumulative probability reaches `P`. It acts as a dynamic cutoff for wild guesses.
- **Frequency/Presence Penalty:** Penalizes tokens based on how often they have already appeared in the text, preventing repetitive loops.

---

## Why it matters in production

Leaving these parameters unconfigured is reckless. A coding agent running at `temperature: 1.0` will eventually invent syntax that does not exist. A creative writing agent running at `temperature: 0.0` will produce robotic, lifeless text.

In production, mismatched parameters lead to unstable agents. If you need JSON output, high entropy will cause formatting errors. You must explicitly configure these parameters based on the specific cognitive task the agent is performing.

---

## How Agenthood implements it

Agenthood defines strict parameter boundaries within the `LLMRequest` type. Every call to an `ILLMProvider` must declare its parameters.

This ensures agents cannot accidentally run amok. It will be implemented in `src/llm/types.ts` (future milestone):

```typescript
// Planned for a future milestone
export interface LLMRequest {
  prompt: string;
  temperature: number; // 0.0 for strict tasks, 0.7 for creative tasks
  topP?: number;
  maxTokens?: number;
  stopSequences?: string[];
}
```

The Society does not guess. It sets `temperature: 0` for operations like The Doorman's commit validation to guarantee absolute determinism.

---

## Hands-on example

You can configure these parameters directly when initializing the runtime layer.

```bash
# Agenthood runtime defaults to low temperature for code tasks
agenthood-run invoke the-scribe "Write a commit" --temperature 0.1
```

Or in TypeScript (future milestone):

```typescript
import { LLMRequest } from '@agenthood/llm';

const strictRequest: LLMRequest = {
  prompt: 'Format this data as JSON.',
  temperature: 0.0,
  maxTokens: 1000
};
```

---

## Further reading

- [ADR-006 — Python runtime as additive layer](../../docs/adr/ADR-006-python-runtime-as-additive-layer.md)
- [`src/llm/types.ts`](../../src/llm/types.ts) — source implementation (planned)
- [Cohere: Parameters Guide](https://docs.cohere.com/docs/temperature-top-p-and-top-k) — how sampling parameters mathematically work

---

## LinkedIn version

**Hook:** If you leave `temperature` at its default, you are surrendering control of your application's entropy.

**Why it matters:**
- High temperature coding agents invent fake syntax
- Low temperature creative agents sound like robots
- Explicit parameter configuration prevents formatting errors in JSON outputs

**→** [Read the full article + implementation walkthrough →](https://fworks-tech.github.io/agenthood/academy/level-1-genai-rag-basics/04-llm-parameters/)
