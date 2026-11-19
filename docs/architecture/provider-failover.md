# Provider Failover

> *The Society does not depend on any single intelligence. It has contingencies.*

---

## Overview

The Agenthood is LLM-agnostic. Any member can run on any supported AI provider.
When a provider fails (rate limit, outage, auth error) the system automatically
switches to the next available provider without interrupting the task.

The human sees the work continue. The Society handles the plumbing.

---

## Supported Providers

The Agenthood runtime is **LLM-agnostic**. The seven providers below are implemented
in [`src/llm/providers/`](../../src/llm/providers/). Any member can run on any provider.

| Provider | Implementation | Model | Notes |
|----------|----------------|-------|-------|
| **OpenCode Go** (preferred) | `OpenCodeGoProvider.ts` | `qwen3.8-flash` | Subscription at `api.opencode.ai/zen/go/v1`; first in the shipped chain |
| **OpenCode Zen** | `OpenCodeProvider.ts` | `qwen3.8-flash` | Pay-as-you-go at `api.opencode.ai/zen/v1` |
| **Anthropic** | `AnthropicProvider.ts` | `claude-sonnet-5` | Fallback in the shipped chain; precise, detailed reasoning |
| **Groq** | `GroqProvider.ts` | `llama-3.3-70b-versatile` | Fallback in the shipped chain; free tier |
| **OpenAI** | `OpenAIProvider.ts` | `gpt-5.4` | Broad general capability; provider default |
| **OpenRouter** | `OpenRouterProvider.ts` | `openai/gpt-4o-mini` | OpenAI-compatible at `api.openrouter.ai/api/v1`; routes to many models |
| **Ollama** | `OllamaProvider.ts` | `llama3.2` | Air-gapped / offline use; no API key |

The models above are the ones `.agenthood/config.example.json` ships. A provider
configured without a `model` falls back to its own default in
[`src/llm/providers/constants.ts`](../../src/llm/providers/constants.ts).

All providers use a unified `ILLMProvider` interface
([`src/llm/ILLMProvider.ts`](../../src/llm/ILLMProvider.ts)) with normalized request and
response types. Member skills are written once and run on any provider via `LLMRouter`
([`src/llm/LLMRouter.ts`](../../src/llm/LLMRouter.ts)).

Additional providers (DeepSeek, Qwen) may be added in future releases.
When added, they will be slotted into the failover chain behind the
seven supported providers.

---

## Failover Chain

The failover chain is user-configured or auto-detected from available API keys:

```
Primary → Fallback 1 → Fallback 2 → ... → Error (all exhausted)
```

**Example chain (the one the shipped config uses):**
```
opencode-go → opencode → anthropic → groq → ollama
```

Thread continuity is preserved across failovers via checkpoint-based `thread_id`.
The member picks up exactly where it left off on the new provider.

---

## Failure Classification

Not all failures are equal. The system classifies them and applies the right response:

| HTTP Status | Classification | Cooldown | Action |
|-------------|---------------|----------|--------|
| `401` | Auth failure | Permanent | Skip provider, alert user |
| `402` | Payment required | Permanent | Skip provider, alert user |
| `429` | Rate limited | 60-300s | Cool down, try next provider |
| `408` | Timeout | 30s | Retry once, then failover |
| `503` | Service unavailable | 60s | Failover immediately |
| `404` | Model not found | Permanent | Skip provider |

---

## Probe Recovery

A provider on cooldown is not written off permanently.

- **30 seconds before cooldown expiry**, the system sends a lightweight probe request
- If the probe succeeds → provider returns to the active pool
- If the probe fails → cooldown is extended

This prevents the system from hammering a recovering provider with full requests.

---

## Circuit Breaker

The Agenthood implements a three-state circuit breaker per provider:

```
CLOSED      → Normal operation, requests flow through
    ↓ (threshold of failures exceeded)
OPEN        → Provider bypassed, failover active
    ↓ (cooldown period expires)
HALF_OPEN   → One probe request allowed
    ↓ (probe succeeds)
CLOSED      → Provider restored
    ↓ (probe fails)
OPEN        → Back to bypass
```

The circuit breaker is configurable per chain:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `failureThreshold` | 1 | Consecutive failures before circuit opens. Permanent errors (auth, payment, model_not_found) always open immediately regardless. |
| `cooldownMs` | Error-specific | Override the cooldown duration in ms (e.g., `5000` to wait 5s before probe). |
| `requestTimeoutMs` | `60000` | Per-request LLM call timeout; the chain rejects with a timeout error when a provider exceeds it. |
| `probeEnabled` | `true` | When `false`, disables preemptive probe recovery. Providers still recover naturally when cooldown expires. |

Five recovery strategies are available for sustained failures:
1. **Immediate retry**, for transient network blips
2. **Exponential backoff**: up to 3 attempts with increasing delay (`1000ms`, `2000ms`)
3. **Provider rotation**: move to next in chain
4. **Model downgrade**: switch to cheaper/faster model on same provider; applies to `complete()`, `stream()`, and `embed()`
5. **Human escalation**: all providers exhausted, alert the human

---

## Credential Security (Planned)

API keys never reach the agent directly.

An HTTP proxy on `localhost` injects credentials from the OS keychain into outbound LLM requests
(not yet implemented). Currently, credentials are injected at the provider constructor level
from environment variables.

---

## Member-Level Provider Preferences

Every member prefers the same provider. The preference is encoded in
`MemberSpec.preferredProvider` in [`src/members/member-specs.ts`](../../src/members/member-specs.ts)
and respected by `LLMRouter.createForMember`, which ranks it ahead of the operator's
config order.

| Members | Preferred Provider | Reason |
|---------|-------------------|--------|
| All shipped members | OpenCode Go | The Society runs on one provider; the config order governs failover |

`MemberRegistry` uses the same value as the default for custom members. The per-member
preference mechanism is unchanged: a member that genuinely needs a different provider can
still declare one, and `--provider` still overrides it for a single run.
