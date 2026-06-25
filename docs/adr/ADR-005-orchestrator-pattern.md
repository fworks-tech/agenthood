# ADR-005: Orchestrator Pattern Over Peer-to-Peer Member Communication

**Date:** 2026-06-02
**Status:** Accepted

## Context

With 14 specialized members, a coordination pattern was needed. Two main
options were available: peer-to-peer (members invoke each other directly)
or orchestrator-driven (a central controller routes tasks to members, which
operate independently and return results).

The choice affects how members are composed, how context is managed, and
what happens when a member hands off to another.

## Decision

The Society uses the **Orchestrator pattern**: the developer (or a Steward-
assisted routing prompt) acts as the orchestrator, invoking individual members
as needed. Members do not invoke each other directly.

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|-------------|
| Peer-to-peer | Members can autonomously compose workflows | Creates hidden invocation chains; context leaks between members; hard to debug | Unpredictable and difficult to audit |
| Orchestrator (chosen) | Explicit invocation; clear context boundaries; each member receives only what it needs | Requires the orchestrator (developer or Steward) to know the routing | — |
| Event-driven (pub/sub) | Decoupled; members react to events | Requires a runtime event bus not available in most AI coding assistants today | No infrastructure support in current runtimes |

## Consequences

**Easier:** Each member's context is controlled — The Tester receives test
context, not release context. Invocations are auditable in conversation history.

**Harder:** Multi-step workflows (e.g., Architect → Tester → Reviewer → Scribe)
require the developer to chain invocations manually or use The Steward for
routing guidance.

**New risk:** Without an automated orchestrator, long workflows rely on the
developer remembering the correct sequence. The Steward's routing table and
the `agentic-workflows/` templates mitigate this.

## References

- [members/the-steward/SKILL.md](https://github.com/fworks-tech/agenthood/blob/main/members/the-steward/SKILL.md) — routing guidance
- [agentic-workflows/](https://github.com/fworks-tech/agenthood/tree/main/agentic-workflows/) — multi-step workflow templates
- [architecture/agent-system.md](https://github.com/fworks-tech/agenthood/blob/main/architecture/agent-system.md) — system design
- [architecture/concurrency-and-queues.md](https://github.com/fworks-tech/agenthood/blob/main/architecture/concurrency-and-queues.md) — queue design
- [ADR-008](ADR-008-typescript-runtime-over-python.md) — TypeScript runtime over Python
