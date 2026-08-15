# ADR-019: Executor contract returns model attribution

**Date:** 2026-08-15
**Status:** Accepted

## Context

The Oracle agent calls the LLM directly (`ask()`), bypassing `ReActLoop.run` — the only place that records which model responded. Every trace and Sentry report therefore carried `model: "unknown"` for Oracle runs. Three successive automated reviews (Warden ×2, Auditor, Reviewer, issue #435, PR #436) flagged the attribution gap and, repeatedly, the way it was being patched: the agent layer mutating `reasoningLoop.model` from outside ("feature envy" / cross-object coupling).

The constraint that shaped the solution: `OracleAgent.ask()` is wired into `ExecutionContext.oracle.ask` (`ApplicationContext.ts`) with the public signature `Promise<string>` — its return type cannot change without breaking every consumer of the oracle companion.

## Decision

The shared executor contract (`BaseAgent.runWithExecutor`) returns the model alongside the output:

```
execute: (systemPrompt, input) => Promise<{ output: string; model?: string }>
```

- `runWithExecutor` applies `ReActLoop.setModel(model)` centrally after execution, before `recordTrace` consumes it
- `OracleAgent` keeps its public `ask(): Promise<string>`; a private `askWithModel()` returns `{ output, model }`, and `run()`'s executor uses the private method
- `BaseAgent.run()`'s default executor wraps `ReActLoop.run` and surfaces `reasoningLoop.model`; the loop continues to own its internal model write

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|-------------|
| Mutate `reasoningLoop.model` from `ask()` (original patch) | One line | Agent pokes loop state from outside; flagged as feature envy in three reviews | Coupling the fix was meant to remove |
| `ReActLoop.setModel()` called by the agent (PR #436) | Encapsulates the write | Still an agent-layer reach-in; Warden reversed its own suggestion on re-scan | Same coupling, better API |
| Change public `ask()` to return `{ output, model }` | Direct | Breaks `ExecutionContext.oracle.ask: Promise<string>` and every consumer | Public API stability is a hard constraint |

## Consequences

- Model attribution is recorded in exactly one place, by the class that owns the loop
- The public Oracle API is unchanged; consumers of `context.oracle.ask` are unaffected
- Executors (Oracle and the ReActLoop wrapper) carry a slightly richer return type — a deliberate cost of the shared lifecycle
- `setModel` remains the loop's public write API for any future caller

## References

- Issue #435, PR #436 (original attribution fix), issue #438 (this hardening wave)
- Warden/Reviewer analyses on PR #436
