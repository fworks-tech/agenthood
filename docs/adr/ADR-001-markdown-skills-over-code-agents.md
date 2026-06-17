# ADR-001: Markdown-Based Skills Over Code-Based Agents

**Date:** 2026-06-02
**Status:** Accepted

## Context

When designing how Society members deliver their expertise to a project, two
implementation paths were evaluated: executable code agents (TypeScript/Python
functions that call LLM APIs directly) and Markdown skill files loaded by
the developer's existing AI runtime.

The primary goal was to make the Society useful across multiple AI runtimes
— Claude Code, GitHub Copilot, Gemini CLI, and others — without requiring
separate codebases per runtime.

## Decision

Society members are implemented as Markdown skill files (`.md`) that are
loaded into the developer's existing AI runtime as contextual instructions.

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|-------------|
| Code-based agents (TS/Python) | Full programmatic control; can be tested with unit tests | Runtime-specific; requires separate implementation per provider; adds dependencies | Locks adopters into a single runtime |
| Markdown skills (chosen) | Runtime-agnostic; zero dependencies; readable by humans and agents alike | Cannot be unit-tested directly; relies on the runtime to interpret intent | — |
| Hybrid (code + Markdown) | Flexibility | Complexity doubles the maintenance surface | Premature for current scope |

## Consequences

**Easier:** Adding a new member requires only a `.md` file — no build step,
no API key, no deployment. Any runtime that accepts context files works.

**Harder:** Skills cannot programmatically enforce their own constraints.
Enforcement requires a separate layer (hooks, CI workflows) that must be
maintained alongside the skill files.

**New risk:** Runtime behaviour varies — a skill that works perfectly in
Claude Code may be interpreted differently by Copilot. The Envoy member
exists to address this cross-provider translation problem.

## Update — Phase 1 (2026-06-02)

The Markdown-first decision is preserved and extended by the Python runtime layer.
`SkillsMiddleware` in DeepAgents reads the `.md` files at agent construction time —
they are passed as file paths, never parsed or modified. The Markdown files remain
the single source of truth for each member's identity and instructions.

See [ADR-006](ADR-006-python-runtime-as-additive-layer.md) and
[ADR-007](ADR-007-deepagents-as-execution-engine.md) for how the runtime uses them.

## References

- [members/the-envoy/SKILL.md](../../members/the-envoy/SKILL.md) — cross-provider translation layer
- [architecture/agent-system.md](../../architecture/agent-system.md) — agent system design
- [ADR-006](ADR-006-python-runtime-as-additive-layer.md) — Python runtime as additive layer
- [ADR-007](ADR-007-deepagents-as-execution-engine.md) — DeepAgents as execution engine
