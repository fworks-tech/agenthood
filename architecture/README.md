# Architecture

> *The Society runs on principles, not just conventions.*

The Agenthood's architecture defines how agents think, coordinate, prioritize,
recover, and operate. These documents are framework-agnostic — they describe
the *what* and *why*, not the implementation.

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
6. **Additive layers** — the TypeScript CLI extends the Society without modifying existing Markdown skills

---

## Runtime Layer (v2.0.0)

The architecture documented here is implemented as a TypeScript CLI in this repo
(`src/`), driven by [ADR-008](../docs/adr/ADR-008-typescript-runtime-over-python.md),
which superseded the earlier Python/DeepAgents runtime approach.

| Component | Implemented in | Status |
|-----------|----------------|--------|
| 14 Society members (skill files) | `members/<name>/SKILL.md` | ✅ Shipped (v1.5.0) |
| TS runtime: `ILLMProvider`, `LLMRouter`, `ReActLoop`, `BaseAgent` | `src/llm/`, `src/reasoning/`, `src/agents/` | ✅ Shipped |
| `MemberRegistry` — wires 14 members to TS `run` | `src/members/MemberRegistry.ts` | ✅ v2.0.0 |
| `ProviderFailover` — circuit breaker + classification | `src/llm/ProviderFailover.ts` | ✅ v2.0.0 |
| `ConcurrencyQueue` — priority + starvation | `src/core/ConcurrencyQueue.ts` | ✅ v2.0.0 |
| `SafetyGuard` — caps, loop detection, blocklist | `src/core/SafetyGuard.ts` | ✅ v2.0.0 |
| Orchestrator (publish/subscribe event bus) | `src/orchestrator/` | 📋 Planned — Phase 3 |
| 5-tier memory (IMemoryStore, ResidualMemory, InMemoryStore, VectorStore, ShortTerm, LongTerm, Episodic, Project) | `src/memory/` | ✅ Shipped |
| RAG — Knowledge Graph Store, ChunkStrategy, Indexer, Retriever, TreeSitterParser | `src/rag/` | ✅ Shipped |
| Society index (members, ADRs, conventions) | `src/project/SocietyIndexer.ts` | ✅ Shipped |

The TS CLI is the single supported runtime for `agenthood run`.
