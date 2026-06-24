# Provider Failover

> *The Society does not depend on any single intelligence. It has contingencies.*

---

## Overview

The Agenthood is LLM-agnostic. Any member can run on any supported AI provider.
When a provider fails — rate limit, outage, auth error — the system automatically
switches to the next available provider without interrupting the task.

The human sees the work continue. The Society handles the plumbing.

---

## Supported Providers

The Agenthood runtime is **LLM-agnostic**. The four providers below are implemented
in [`src/llm/providers/`](../src/llm/providers/) and are the supported set as of
v2.0.0. Any member can run on any provider.

| Provider | Default model | Notes |
|----------|---------------|-------|
| **Anthropic** | Claude Sonnet 4.6 | Primary for most members; precise, detailed reasoning |
| **Groq** | llama-3.1-70b-versatile | Default when no provider is configured; free tier |
| **OpenAI** | GPT-4o | Broad general capability; fallback for Anthropic |
| **Ollama** | Local model (configurable) | Air-gapped / offline use; default for the Doorman |

All providers use a unified `ILLMProvider` interface
([`src/llm/ILLMProvider.ts`](../src/llm/ILLMProvider.ts)) with normalized request and
response types. Member skills are written once and run on any provider via `LLMRouter`
([`src/llm/LLMRouter.ts`](../src/llm/LLMRouter.ts)).

### Planned providers

The earlier roadmap mentioned Google Gemini, DeepSeek, and Qwen. They are not
implemented yet; once added they will be slotted into the failover chain behind
the four supported providers.

---

## Failover Chain

The failover chain is user-configured or auto-detected from available API keys:

```
Primary → Fallback 1 → Fallback 2 → ... → Error (all exhausted)
```

**Example chain:**
```
Claude Sonnet 4.6 → GPT-4o → Groq → Ollama
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
| `429` | Rate limited | 60–300s | Cool down, try next provider |
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
| `probeEnabled` | `true` | When `false`, disables preemptive probe recovery. Providers still recover naturally when cooldown expires. |

Five recovery strategies are available for sustained failures:
1. **Immediate retry** — for transient network blips
2. **Exponential backoff** — up to 3 attempts with increasing delay (`1000ms`, `2000ms`)
3. **Provider rotation** — move to next in chain
4. **Model downgrade** — switch to cheaper/faster model on same provider; applies to `complete()`, `stream()`, and `embed()`
5. **Human escalation** — all providers exhausted, alert the human

---

## Credential Security

API keys never reach the agent directly.

An HTTP proxy on `localhost` injects credentials from the OS keychain into outbound LLM requests:
- Routes per provider
- Session token authentication between agent and proxy
- Per-provider rate limiting enforced at proxy layer
- Audit log (ring buffer, 1000 entries) for all credential usage
- 10 MB body size limit

---

## Member-Level Provider Preferences

Different members prefer different providers based on their task type. These
preferences are encoded in `MemberSpec.preferredProvider` in
[`src/members/MemberRegistry.ts`](../src/members/MemberRegistry.ts) and respected
by `LLMRouter` when building the failover chain.

| Member | Preferred Provider | Reason |
|--------|-------------------|--------|
| The Scribe | Anthropic | Strong at natural language writing |
| The Architect | Anthropic | Long context, reasoning |
| The Reviewer | Anthropic | Precise, detailed analysis |
| The Auditor | Anthropic | Security reasoning, caution |
| The Tester | Anthropic | Structured output, deterministic |
| The Debugger | Anthropic | Broad training on error patterns |
| The Herald | Anthropic | Templated output, low complexity |
| The Librarian | Anthropic | Documentation quality |
| The Doorman | Ollama → Groq | Fast, simple validation — no need for top-tier model |
| The Oracle | Anthropic | Long-context retrieval |
| The Envoy | Anthropic | Cross-runtime translation |
| The Sentinel | Anthropic | Standards enforcement |
| The Warden | Anthropic | Code health analysis |
| The Steward | Groq | Lightweight routing, low cost |
