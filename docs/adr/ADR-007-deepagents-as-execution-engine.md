# ADR-007: DeepAgents as Execution Engine

**Date:** 2026-06-02
**Status:** Accepted

## Context

The Python runtime needs an LLM execution engine that can:
1. Load Markdown skill files as agent system prompts
2. Compose middleware (memory, summarization, skills, filesystem) per agent
3. Support human-in-the-loop approval gates (`interrupt_on`)
4. Run on LangGraph's durable checkpointer so sessions are resumable
5. Support per-model configuration (model, temperature, response format)

Building all of this from scratch against the LangGraph and LangChain APIs would take weeks and produce a bespoke harness that no external contributor would recognize.

## Decision

Use `fworks-tech/deepagents` (a fork of an open-source Python agent harness) as the execution engine for all member agents. The fork is pinned to an exact commit hash in `pyproject.toml` to prevent surprise API changes.

The integration surface is narrow:
- `create_deep_agent(spec: SubAgent, store: StoreBackend) → CompiledGraph` — one function call per member invocation
- `SubAgent` TypedDict — the schema used in `specs.py` to define all 14 members
- Middleware classes: `SkillsMiddleware`, `MemoryMiddleware`, `SummarizationMiddleware`
- `StoreBackend` protocol — wrapped by `AgenhoodStore` in Phase 2

Agenthood does not fork or modify DeepAgents internals. If the upstream API changes, only `specs.py` and `registry.py` need to be updated — the rest of the runtime is insulated.

The `SkillsMiddleware` in DeepAgents loads Markdown files via `skills: list[str]` paths on the SubAgent spec. This is the bridge: `SkillsPathResolver` in `loader.py` converts member names to absolute `.md` paths, which are passed into the SubAgent spec. The Markdown files are never copied, parsed, or modified — they are passed as file paths and read at agent construction time.

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|-------------|
| Raw LangGraph + LangChain | No external dependency | Must implement SkillsMiddleware, MemoryMiddleware, HarnessProfile, interrupt_on from scratch; months of work | Rejected: redundant effort |
| LangGraph Platform (cloud) | Managed hosting | Vendor lock-in; requires SaaS account; not self-hostable | Rejected: conflicts with local-first design |
| AutoGen / CrewAI | Mature, popular | Different orchestration model; doesn't support Markdown-as-spec loading; migration cost if patterns change | Rejected: poor fit for Agenthood's identity model |

## Consequences

**Easier:**
- SkillsMiddleware, MemoryMiddleware, and interrupt_on are handled by DeepAgents — runtime code stays thin
- LangGraph checkpointing, MemorySaver, and BaseStore are provided transparently

**Harder:**
- The runtime has a hard dependency on a forked package not in PyPI — must be installed via git URL or local path
- If `fworks-tech/deepagents` becomes abandoned, the runtime inherits its bugs

**New risks:**
- API drift between pinned commit and future DeepAgents versions. Mitigation: pin by commit hash; add an integration test that calls `create_deep_agent` with the-scribe spec and asserts output contains skill text.
- `SubAgent` TypedDict keys change. Mitigation: `specs.py` import validates at module load; CI will catch it immediately.

## References

- [ADR-006: Python Runtime as Additive Layer](ADR-006-python-runtime-as-additive-layer.md)
- [fworks-tech/deepagents](https://github.com/fworks-tech/deepagents)
- [architecture/built-in-tools.md](../../architecture/built-in-tools.md) — Member → Tool Scope table drives `specs.py`
- GitHub issue: [#45](https://github.com/fworks-tech/agenthood/issues/45)
