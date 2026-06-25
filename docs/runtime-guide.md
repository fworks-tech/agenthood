# Runtime Guide

## Provider Failover Configuration

The runtime supports automatic provider failover when a provider fails (rate limit, outage, auth error). Configure an ordered list of providers in `.agenthood/config.json`:

```json
{
  "providers": [
    {
      "name": "anthropic",
      "model": "claude-sonnet-4-6",
      "models": ["claude-sonnet-4-6", "claude-haiku-3-5"],
      "priority": 1
    },
    {
      "name": "groq",
      "model": "llama-3.1-70b-versatile",
      "priority": 2
    },
    {
      "name": "ollama",
      "model": "llama3.2",
      "baseUrl": "http://localhost:11434",
      "priority": 3
    }
  ],

  "_comment_failover": "Optional circuit breaker and probe recovery settings",
  "failover": {
    "failureThreshold": 3,
    "cooldownMs": 60000,
    "probeEnabled": true
  }
}
```

- **`providers[]`** — Ordered list of LLM providers. First entry is primary, subsequent entries are fallbacks tried in order. Each entry supports `models[]` for model downgrade on failure.
- **`failover`** (optional) — Circuit breaker tuning: `failureThreshold` (consecutive failures before skipping), `cooldownMs` (override cooldown), `probeEnabled` (enable/disable probe recovery).

See `.agenthood/config.example.json` for the complete reference.

## CLI Provider Override

Override the provider at runtime:

```bash
agenthood run <agent> "<task>" --provider ollama
```

This bypasses the configured provider chain and uses the specified provider directly.

## Logging

When failover activates, the runtime logs provider selection to stderr:

```
Using anthropic (primary)
anthropic failed, falling back to groq
groq failed, falling back to ollama
All providers exhausted
```
