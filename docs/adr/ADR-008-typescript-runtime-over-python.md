# ADR-008: TypeScript-Native Runtime Over Python + DeepAgents

**Date:** 2026-06-02
**Status:** Accepted
**Supersedes:** ADR-006 (Python runtime), ADR-007 (DeepAgents) — both deleted

## Context

ADR-006 introduced a separate Python package (`agenthood-runtime`) to provide the
agentic execution layer, and ADR-007 selected DeepAgents + LangGraph as the execution
engine. In practice, shipping a Python runtime alongside a Node.js CLI created two
parallel stacks — two language runtimes, two package managers, two release pipelines —
without delivering the v2 TypeScript runtime faster.

The AI/ML ecosystem assumption that favoured Python (LangGraph, LangChain) has eroded:
TypeScript-native equivalents now cover the same ground, and the adopter base is
predominantly TypeScript/Node.js. Maintaining Python expertise as a contributor
requirement adds friction without adding capability that couldn't be built in TypeScript.

## Decision

The v2 agentic runtime is built entirely in TypeScript, living in `src/agents/`,
`src/llm/`, and `src/memory/` within the existing Node.js package. No separate Python
package is introduced or maintained.

The `members/the-*/SKILL.md` files remain unchanged —
they are runtime-agnostic by design (ADR-001) and require no migration.

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|-------------|
| Keep Python runtime (ADR-006 path) | Python ML ecosystem; LangGraph native | Two stacks; contributor Python requirement; slower delivery | Added complexity without accelerating v2 |
| DeepAgents + LangGraph in Python (ADR-007 path) | Mature state graph library | Python-only; external dependency; version lock risk | Superseded by ADR-006 rejection |
| TypeScript-native runtime (chosen) | Single stack; no new language requirement; ships in existing package | Younger TS LLM ecosystem | TypeScript tooling is now sufficient for the required scope |

## Consequences

**Easier:**
- Single language across CLI, runtime, and tests — contributors need only TypeScript
- The existing `npm test` suite covers all layers without a Python test harness
- Semantic-release handles one package, one changelog, one version

**Harder:**
- Python ML ecosystem libraries (LangGraph, APScheduler) are unavailable; TypeScript
  equivalents must be chosen or built
- Any adopters who had installed the Python runtime prototype must migrate; the Python
  package will not be published

**Eliminated risk:**
- `AGENTHOOD_ROOT` env var requirement and `SkillsPathResolver` complexity from ADR-006
  are no longer needed

## References

- [ADR-001](ADR-001-markdown-skills-over-code-agents.md) — Markdown skills remain runtime-agnostic
- ADR-006 — Python runtime (deleted, superseded by this ADR)
- ADR-007 — DeepAgents (deleted, superseded by this ADR)
- [ADR-009](ADR-009-groq-as-default-llm-provider.md) — Groq as default provider in the TS runtime
- [ADR-010](ADR-010-lancedb-for-vector-storage.md) — LanceDB as embedded vector store
