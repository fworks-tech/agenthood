# Guide: Adding a New LLM Provider

> The Agenthood is LLM-agnostic by design. Adding a new provider means
> implementing one interface and registering it in two places.

## Overview

Every provider lives in `src/llm/providers/` and implements `ILLMProvider`.
Once registered, the provider is available in the failover chain, configurable
via `.agenthood/config.json`, and routeable per member.

## Step-by-step

### 1. Create the provider file

```bash
touch src/llm/providers/OpenCodeProvider.ts
```

### 2. Implement `ILLMProvider`

You must implement all five methods:

| Method | Signature | What it does |
|--------|-----------|-------------|
| `complete` | `(request: LLMRequest) => Promise<LLMResponse>` | Synchronous text generation |
| `stream` | `(request: LLMRequest) => Promise<AsyncGenerator<LLMChunk>>` | Streaming text generation |
| `embed` | `(text: string) => Promise<number[]>` | Vector embedding (may throw `UnsupportedOperationError`) |
| `getContextWindow` | `() => number` | Max context window in tokens |
| `setModel` | `(model: string) => void` | Switch model at runtime (for Strategy 4 downgrade) |

### 3. Follow the constructor pattern

```typescript
import type { ILLMProvider } from '../ILLMProvider.js'
import type { LLMRequest, LLMResponse, LLMChunk, LLMConfig } from '../types.js'

export class OpenCodeProvider implements ILLMProvider {
  private client: SomeSDKClient
  private model: string

  constructor(config: LLMConfig) {
    this.client = new SomeSDKClient({
      apiKey: config.apiKey ?? process.env.OPencode_API_KEY ?? '',
      baseURL: config.baseUrl,
    })
    this.model = config.model ?? 'opencode-default-model'
  }
  // ...
}
```

- Accept `LLMConfig` as the sole constructor argument
- Read credentials from `config.apiKey` first, then fall back to `process.env`
- Store `config.model` (with a sensible default)

### 4. Map SDK errors to Agenthood error classes

Wrap SDK calls and translate provider-specific errors into the canonical types
in `src/llm/errors.ts`:

| SDK error | Map to | Effect |
|-----------|--------|--------|
| 401 / invalid auth | `AuthError` | Permanent circuit trip |
| 402 / quota | `PaymentRequiredError` | Permanent circuit trip |
| 429 / rate limit | `RateLimitedError` | Cooldown + retry |
| 408 / timeout | `TimeoutError` | Retry with backoff |
| 503 / down | `ServiceUnavailableError` | Failover |
| 404 / bad model | `ModelNotFoundError` | Skip to next fallback model |

Example:

```typescript
async complete(request: LLMRequest): Promise<LLMResponse> {
  try {
    const response = await this.client.chat.create({ ... })
    return {
      content: response.text,
      usage: {
        promptTokens: response.usage?.prompt ?? 0,
        completionTokens: response.usage?.completion ?? 0,
        totalTokens: response.usage?.total ?? 0,
      },
      model: response.model,
    }
  } catch (err) {
    const status = extractStatus(err)
    if (status === 401) throw new AuthError('OpenCode', extractDetail(err))
    if (status === 429) throw new RateLimitedError('OpenCode', extractRetryAfter(err))
    throw err // let classifyError handle the rest
  }
}
```

### 5. Register the provider factory in `LLMRouter`

Add a lazy-loaded factory to `LLMRouter.providerFactories` in
`src/llm/LLMRouter.ts`:

```typescript
private static providerFactories: Record<string, ProviderFactory> = {
  // ... existing providers ...
  opencode: async (c) => {
    const { OpenCodeProvider } = await import('./providers/OpenCodeProvider.js')
    return new OpenCodeProvider(c)
  },
}
```

The key (`opencode`) becomes the provider name used in config files and on the CLI.

### 6. Add to the config example

Update `.agenthood/config.example.json` with an example entry:

```json
{
  "provider": {
    "name": "opencode",
    "model": "opencode-default-model"
  }
}
```

For the failover chain with model fallback:

```json
{
  "llm": {
    "providers": [
      {
        "name": "opencode",
        "model": "opencode-pro",
        "apiKey": "...",
        "models": ["opencode-pro", "opencode-lite"]
      },
      {
        "name": "groq",
        "model": "llama-3.1-70b-versatile",
        "apiKey": "..."
      }
    ]
  }
}
```

### 7. Verify it works

| Check | Command |
|-------|---------|
| No type errors | `npx tsc --noEmit` |
| Basic completion | `agenthood run the-scribe "hello" --provider opencode` |
| All tests pass | `npx vitest run --exclude 'vscode-extension/**'` |
| Failover triggers | Configure a bad API key for OpenCode + working Groq backup |

## Checklist

- [ ] File created at `src/llm/providers/<Name>Provider.ts`
- [ ] All five `ILLMProvider` methods implemented
- [ ] Error mapping covers 401/402/429/408/503/404
- [ ] Factory registered in `LLMRouter.providerFactories`
- [ ] `embed()` throws `UnsupportedOperationError` if not supported
- [ ] No type errors
- [ ] Provider works with `agenthood run` via `--provider`
- [ ] Provider participates in failover chain when configured
