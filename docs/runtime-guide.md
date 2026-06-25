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

## API Key Validation

The runtime validates LLM API keys at startup before making any provider calls. Only the configured provider's key is checked — if you set `provider` to `"ollama"`, no key validation is performed.

Key resolution order (per provider):
1. `providers[].apiKey` — key in config array entry
2. `apiKey` — top-level key in config
3. `GROQ_API_KEY` / `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` — environment variables

If no key is found and the provider requires one, startup fails with:
```
GROQ_API_KEY not set for provider "groq". Get a key at https://console.groq.com
```

Run `npx agenthood check` to verify API key configuration as part of a full health check.

### Ollama / Local Providers

Providers not in the known key list (ollama, custom-local) skip key validation entirely — no key required.

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
