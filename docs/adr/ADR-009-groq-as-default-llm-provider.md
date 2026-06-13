# ADR-009: Groq as the Default Free LLM Provider

**Date:** 2026-06-02
**Status:** Accepted

## Context

The v2 TypeScript runtime (ADR-008) requires a default LLM provider. Adopters running
`npx agenthood init` should be able to invoke Society members without a paid API key.
The provider must be fast enough for interactive use and reliable enough for CI.

Four providers were evaluated: OpenAI, Anthropic, Google Gemini, and Groq. The key
constraint is that the default must be free-tier accessible — adopters should not need
a billing account to experience the Society's agentic capabilities.

## Decision

Groq is the default LLM provider in `src/llm/providers/GroqProvider.ts`. It is
selected for its free tier, low-latency inference (LPU hardware), and OpenAI-compatible
API surface, which minimises the `ILLMProvider` implementation complexity.

Adopters can override the provider via `.agenthood/config.json`:
```json
{ "llm": { "provider": "anthropic", "model": "claude-sonnet-4-6" } }
```

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|-------------|
| OpenAI (`gpt-4o-mini`) | Most widely known; extensive docs | No free tier; requires billing account | Fails the zero-cost-to-start requirement |
| Anthropic (`claude-haiku-4-5`) | Best Society alignment; multimodal | No free tier | Same as OpenAI |
| Google Gemini (`gemini-flash`) | Free tier available; fast | API surface differs from OpenAI; more adapter code | Groq free tier is faster |
| Groq (chosen) | Free tier; OpenAI-compatible API; fastest inference | Smaller model selection; rate limits on free tier | — |

## Consequences

**Easier:**
- Zero-friction onboarding — `npx agenthood init` works without a credit card
- `GroqProvider` reuses the OpenAI-compatible SDK path, reducing adapter surface
- Swapping providers is a one-line config change

**Harder:**
- Groq free tier has rate limits that may throttle heavy CI usage
- Groq model availability changes more frequently than OpenAI/Anthropic

**New risk:**
- If Groq discontinues the free tier, the default must be updated; `ILLMProvider`
  abstraction ensures this is a single-file change

## References

- [ADR-008](ADR-008-typescript-runtime-over-python.md) — TypeScript runtime this provider ships with
- [ADR-010](ADR-010-lancedb-for-vector-storage.md) — companion storage decision
- GitHub issue: [#87](https://github.com/fworks-tech/agenthood/issues/87)
