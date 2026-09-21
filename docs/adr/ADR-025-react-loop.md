# ADR-025: ReAct Tool Loop for Member and Core-Agent Runs

**Date:** 2026-09-21
**Status:** Accepted

## Context

Members act on repositories: they must read files, search code, propose edits, and ask
humans — in varying order, decided at runtime by the model. A fixed pipeline cannot
express that; a fully autonomous loop without bounds cannot be trusted or paid for
(open-ended token spend, runaway tool calls).

## Decision

`src/reasoning/ReActLoop.ts` drives every member run: the LLM alternates reasoning steps
with tool invocations until it produces a final answer or `MaxStepsExceededError` fires.
Each tool is constructed from `TOOL_MAP` in `MemberAgent` and gated before use:

- `permissionProfile` (restricted/standard/trusted) classifies every tool fail-closed —
  an unclassified tool is denied for every profile.
- SKILL.md `allowed-tools` may narrow the profile set but never expand it (ADR-028).
- `SafetyGuard` inspects commands; `security.sandbox` layers integrity confirmation and,
  when Docker is present, container isolation (ADR-020 lineage).

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|-------------|
| Fixed pipeline per member | predictable, cheap | cannot branch on findings; each member becomes bespoke glue | Rejected |
| Unbounded autonomy | maximal capability | no cost or safety ceiling | Rejected |
| Single-shot completion + JSON tool protocol only | simplest | members lose iterative verification (run tests, read results) | Rejected |

## Consequences

Easier: one loop implementation to audit; step cap is one number; tool grants are data
(frontmatter + profile), not code paths. Harder: prompt format must keep the model inside
the loop contract; every new tool must be classified into a tier or it silently fails
closed by design.

## References

- `src/reasoning/ReActLoop.ts`, `src/agents/base/BaseAgent.ts`, `src/members/MemberAgent.ts`
- ADR-008 (TypeScript runtime), ADR-020 (mind-virus mitigation), ADR-028
