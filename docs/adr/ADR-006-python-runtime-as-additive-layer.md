# ADR-006: Python Runtime as Additive Layer (SUPERSEDED)

**Date:** 2026-06-02
**Status:** **Superseded by ADR-008** — the TypeScript runtime in `src/` is the
single supported runtime. The Python package in `runtime/` is retained as
experimental reference only and is **not** on the supported install path.

## Context

Agenthood v1 is a prompt-driven framework: 14 Markdown skill files installed by a Node.js CLI. All architecture (orchestrator, memory, rituals, portals) is documented but unimplemented as running code. The Society's members exist as identities — not as autonomous agents.

Making members autonomous requires an LLM execution engine, a state graph, persistent memory, and a scheduler. None of these fit naturally in a Node.js CLI whose sole purpose is file installation. A new runtime layer is needed.

The core constraint: the existing `members/*/SKILL.md` skill files and `src/` CLI must never be modified. Any adopter who has run `npx agenthood init` has these files. The runtime must be invisible to them unless they opt in.

## Decision

Introduce a separate Python package (`runtime/agenthood-runtime`) that lives alongside the existing Node.js package without touching it. The two share a single contract: `.agenthood/config.json` — the Node.js CLI writes it on `init`; the Python runtime reads it on startup.

The Python runtime is:
- A separate installable package (`pip install agenthood-runtime`)
- Never a dependency of the Node.js package
- Purely additive — removing it restores the v1 experience exactly

Python is chosen over Node.js for the runtime because the AI/ML ecosystem (LangGraph, LangChain, DeepAgents) is Python-native. Maintaining a parallel TypeScript LLM stack would create unnecessary friction.

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|-------------|
| Extend the Node.js CLI with LLM calls | One language, one package | No mature TypeScript LangGraph equivalent; adds heavy deps to installation-only CLI | Rejected: wrong tool for the job |
| Replace Node.js CLI with Python | Single language stack | Breaks all existing adopter installs; violates "additive only" principle | Rejected: destructive |
| Separate repo for the runtime | Clean separation | Divergence of members/* and runtime specs; two repos to keep in sync | Rejected: single source of truth matters more |

## Consequences

**Easier:**
- Full Python AI/ML ecosystem available (LangGraph, LangChain, APScheduler)
- Existing adopters unaffected — they keep their v1 experience
- The runtime can evolve independently without coordination with CLI releases

**Harder:**
- Contributors must know both Node.js and Python
- The `.agenthood/config.json` contract must be versioned and stable
- The `AGENTHOOD_ROOT` env var must be set in installed-package scenarios so `SkillsPathResolver` can locate `members/*.md`

**New risks:**
- `members/*/SKILL.md` and `specs.py` can drift if a new member is added to one but not the other. Mitigation: `MemberRegistry.__init__` validates that every SKILL.md file has a corresponding spec at startup.

## References

- [ADR-005: Orchestrator Pattern](ADR-005-orchestrator-pattern.md)
- [ADR-007: DeepAgents as Execution Engine](ADR-007-deepagents-as-execution-engine.md)
- [architecture/built-in-tools.md](https://github.com/fworks-tech/agenthood/blob/main/architecture/built-in-tools.md)
- GitHub issue: [#45](https://github.com/fworks-tech/agenthood/issues/45)
