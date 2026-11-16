# Agent Memory

> *An agent with no memory repeats its mistakes. An agent with no memory governance accumulates them.*

---

## What it is

Agent memory carries information forward, both across the iterations of one task and across separate tasks. Without it, every step starts from zero. With it, the agent remembers what it tried, what worked, what the codebase looks like and what it learned last time.

Memory types differ. A working buffer that holds the last few tool outputs has little in common with a store that survives a process restart. Treating them as one thing produces the two usual failures: context overflow, where the working buffer grows until it pushes out the prompt, and stale poisoning, where the persistent store accumulates facts that were true last month and are wrong today.

The Society separates memory into tiers, each with its own lifecycle, retrieval path and eviction policy. A query against the long-term fact store and a query against the last tool output take different routes, and a project-level fact is not evicted the way a working-context entry is.

---

## Why it matters in production

Short-term memory fills up. Every tool call, every observation, every intermediate reasoning step adds tokens to the context window. Without compression or eviction, the window overflows, and the model starts dropping the earliest, most important context (the user's actual request) to make room for the latest, least important (the tenth tool output). This is why agents hallucinate halfway through long tasks: they have literally forgotten what they were asked to do.

Long-term memory without governance is worse. An agent that "remembers" a deprecated API signature from three months ago will confidently call it today and fail. The failure is silent because the agent has no reason to doubt its own memory. Stale facts poison fresh queries, and because the memory store is opaque, you cannot tell which fact is the bad one without a full audit.

Each tier therefore needs an explicit lifecycle. Short-term memory is cheap and disposable. Long-term memory is expensive, so it has to be versioned, timestamped and refreshable. Project memory, the knowledge about a specific codebase, must be invalidated when the code changes. A single unmanaged bucket is how "the agent remembers" turns into a defect.

---

## How Agenthood implements it

Agenthood's memory model is five tiers, each in `src/memory/`. The interface that unifies the key-value tiers is `IMemoryStore`:

```typescript
export interface IMemoryStore<T> {
  set(key: string, value: T, ttlMs?: number): Promise<void>;
  get(key: string): Promise<T | undefined>;
  delete(key: string): Promise<number>;
  has(key: string): Promise<boolean>;
  clear(): Promise<void>;
  size(): Promise<number>;
  prune(policy: RetentionPolicy): Promise<number>;
  stats(): Promise<{ totalEntries: number; oldestEntry: Date | null }>;
}

export const MEMORY_TIERS = {
  short:    { ttl: 1,        unit: 'task'  },  // working context buffer
  long:     { ttl: Infinity, unit: 'forever' }, // persistent facts
  episodic: { ttl: Infinity, unit: 'forever' }, // past execution traces
  project:  { ttl: Infinity, unit: 'forever' }, // codebase knowledge
  residual: { ttl: 1,        unit: 'task'  },  // implicit trace signals
} as const;
```

The five tiers serve distinct purposes. **Short-term** holds the working context for the current task: the last few observations, the current plan, the active tool outputs. **Long-term** holds persistent facts that survive across sessions: the user's preferences, the project's conventions, the team's commit style. **Episodic** stores past execution traces so the agent can recall how it solved a similar problem before. **Project** holds indexed knowledge about the codebase itself: file structure, dependency graph, API surfaces. **Residual** captures implicit signals left in the trace that no tier explicitly claimed, so nothing is silently lost.

ADR-010 covers the vector store backing long-term and project memory (LanceDB, embedded, zero infrastructure).

### Beyond the tiers: decision and provenance records

On top of the five tiers sit the records that make the society accountable
([ADR-015](../../adr/ADR-015-decision-intelligence-and-provenance.md)). Every
member run writes:

- a **decision entry** (`.agenthood/decisions/`): what the member decided,
  with confidence and causal links to related decisions (`CAUSED`,
  `INFLUENCED`, `PRECEDENT_FOR`)
- a **provenance entry** (`.agenthood/provenance/`), who ran, what activity,
  what source input, joined into a tamper-evident SHA-256 hash chain that
  `verifyChain()` can prove unmodified

This is the memory tier that answers *"why did the society do X?"*: decisions
are traceable to their causes, searchable as precedent, and replayable via
society-graph snapshots. The full design is in
[decision-intelligence.md](../../architecture/decision-intelligence.md).

---

## Hands-on example

```bash
agenthood run builder "fix the same bug we fixed in the billing service last week"
```

The agent queries episodic memory for past billing-service fixes, retrieves the relevant trace, and applies the learned pattern. Without episodic memory, it would start from scratch:

```typescript
import { EpisodicMemory } from 'agenthood';

const episodic = new EpisodicMemory();
const prior = await episodic.query({ topic: 'billing-service-bug', limit: 3 });

// prior[0].trace: the exact steps that fixed it last time
// prior[0].outcome: what worked, what did not
```

---

## Further reading

- [ADR-010: LanceDB for vector storage](../../adr/ADR-010-lancedb-for-vector-storage.md): the embedded store backing long-term and project memory
- [`src/memory/IMemoryStore.ts`](../../../src/memory/IMemoryStore.ts): memory store interface
- [`src/memory/ResidualMemory.ts`](../../../src/memory/ResidualMemory.ts): decay-weighted trace signal memory
- [`src/memory/stores/InMemoryStore.ts`](../../../src/memory/stores/InMemoryStore.ts): TTL/LRU in-memory store
- [`src/memory/VectorStore.ts`](../../../src/memory/VectorStore.ts): LanceDB-backed vector store
- [The Cognitive Architecture for Language Agents (CoALA)](https://arxiv.org/abs/2309.02427): the memory taxonomy paper this model derives from


