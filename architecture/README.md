# Architecture

> *The Society runs on principles, not just conventions.*

The Agenthood's architecture defines how agents think, coordinate, prioritize,
recover, and operate. These documents are framework-agnostic — they describe
the *what* and *why*, not the implementation.

Inspired by the technical architecture of [CodeBuddy](https://github.com/olasunkanmi-SE/codebuddy).

---

## Documents

| Document | What it covers |
|----------|---------------|
| [agent-system.md](agent-system.md) | Multi-agent design, orchestrator pattern, member roles |
| [concurrency-and-queues.md](concurrency-and-queues.md) | Priority queues, concurrency slots, starvation prevention |
| [operating-modes.md](operating-modes.md) | Agent mode vs Ask mode, when to use each |
| [provider-failover.md](provider-failover.md) | Multi-LLM support, failure classification, fallback chains |
| [built-in-tools.md](built-in-tools.md) | Core tool registry, tool scoping per member, safety caps |

---

## The Execution Flow

Every task the Agenthood handles follows this path:

```
User Request
    ↓
InputValidator          — sanitize, classify, check permissions
    ↓
ConcurrencyQueue        — assign priority, wait for slot
    ↓
Orchestrator            — route to the right member(s)
    ↓
Member Execution        — reason → act → observe loop
    ↓
SafetyGuard             — enforce limits, detect loops
    ↓
ProviderFailover        — retry with backup LLM if needed
    ↓
DiffReview              — surface changes for human approval
    ↓
Response
```

---

## Design Principles

1. **Specialization over generalism** — each member does one thing well
2. **Events over direct calls** — members communicate through the orchestrator
3. **Human approval gates** — destructive actions always surface for review
4. **Fail safe, not fail silent** — errors are classified, logged, and recovered from
5. **One source of truth** — conventions live in one place, everything reads from there
6. **Additive layers** — the Python runtime (Layer 7) extends the Society without modifying existing Markdown skills or the Node.js CLI

---

## Runtime Layer (v2.0.0)

The architecture documented here is being implemented as a Python runtime package.
Member skills remain unchanged — the runtime reads them as-is via `SkillsMiddleware`.

| Component | Document | Status |
|-----------|---------|--------|
| Python runtime package | [ADR-006](../docs/adr/ADR-006-python-runtime-as-additive-layer.md) | Phase 1 — complete |
| DeepAgents execution engine | [ADR-007](../docs/adr/ADR-007-deepagents-as-execution-engine.md) | Phase 1 — complete |
| Shared memory layer | ADR-008 (planned) | Phase 2 |
| LangGraph orchestrator | ADR-009 (planned) | Phase 3 |
| Ritual scheduler | — | Phase 4 |
| GitHub portal tools | — | Phase 5 |

See [runtime/](../runtime/) for the implementation.
