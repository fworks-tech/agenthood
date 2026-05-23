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

| Provider | Models | Notes |
|----------|--------|-------|
| **Anthropic** | Claude Sonnet 4.6, Claude Opus 4.7 | Primary for most members |
| **Google** | Gemini 2.5 Pro | Strong for analysis tasks |
| **OpenAI** | GPT-4o | Broad general capability |
| **DeepSeek** | deepseek-chat | Cost-efficient for simpler tasks |
| **Groq** | llama-3.1-70b-versatile | Fast inference |
| **Ollama** | Local models | Air-gapped / offline use |
| **Qwen** | qwen-max | Multilingual tasks |

All providers use a unified `buildModel()` interface with normalized configuration.
Member skills are written once and run on any provider.

---

## Failover Chain

The failover chain is user-configured or auto-detected from available API keys:

```
Primary → Fallback 1 → Fallback 2 → ... → Error (all exhausted)
```

**Example chain:**
```
Claude Sonnet 4.6 → Gemini 2.5 Pro → GPT-4o → Groq
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

Five recovery strategies are available for sustained failures:
1. **Immediate retry** — for transient network blips
2. **Exponential backoff** — 3 attempts with increasing delay
3. **Provider rotation** — move to next in chain
4. **Model downgrade** — switch to cheaper/faster model on same provider
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

Different members can prefer different providers based on their task type:

| Member | Preferred Provider | Reason |
|--------|-------------------|--------|
| The Scribe | Claude | Strong at natural language writing |
| The Architect | Claude / Gemini | Long context, reasoning |
| The Reviewer | Claude | Precise, detailed analysis |
| The Auditor | Claude | Security reasoning, caution |
| The Tester | Any | Structured output, deterministic |
| The Debugger | Claude / GPT-4o | Broad training on error patterns |
| The Herald | Any | Templated output, low complexity |
| The Librarian | Claude | Documentation quality |
| The Doorman | Local / Groq | Fast, simple validation — no need for top-tier model |
