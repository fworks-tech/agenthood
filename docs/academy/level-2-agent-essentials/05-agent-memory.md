# Agent Memory

> *An agent with no memory repeats its mistakes. An agent with no memory governance accumulates them.*

---

## What it is

Agent memory is the system that lets an agent carry information forward — across iterations of a single task, and across tasks entirely. Without it, every reasoning step starts from zero. With it, the agent remembers what it tried, what worked, what the codebase looks like, and what it learned last time.

Not all memory is the same. A working context buffer that holds the last few tool outputs is fundamentally different from a persistent knowledge store that survives process restarts. Treating them as one thing produces the two most common memory failures: context overflow (the working buffer grows until it pushes out the prompt itself) and stale poisoning (the persistent store accumulates facts that were true last month but are wrong today).

The Society's model separates memory into tiers, each with its own lifecycle, its own retrieval path, and its own eviction policy. You do not query a long-term fact store the same way you query the last tool output. You do not evict a project-level fact the same way you evict a working-context buffer entry.

---

## Why it matters in production

Short-term memory fills up. Every tool call, every observation, every intermediate reasoning step adds tokens to the context window. Without compression or eviction, the window overflows — and the model starts dropping the earliest, most important context (the user's actual request) to make room for the latest, least important (the tenth tool output). This is why agents hallucinate halfway through long tasks: they have literally forgotten what they were asked to do.

Long-term memory without governance is worse. An agent that "remembers" a deprecated API signature from three months ago will confidently call it today and fail. The failure is silent because the agent has no reason to doubt its own memory. Stale facts poison fresh queries, and because the memory store is opaque, you cannot tell which fact is the bad one without a full audit.

This is why each memory tier needs an explicit lifecycle. Short-term memory is cheap and disposable. Long-term memory is expensive and must be versioned, timestamped, and refreshable. Project memory — knowledge about a specific codebase — must be invalidated when the codebase changes. Treating memory as a single bucket is the architectural mistake that turns "the agent remembers" from a feature into a defect.

---

## How Agenthood implements it

Agenthood's memory model is five tiers, each in `src/memory/` (coming in v2.1.0). The interface that unifies them is `IMemoryStore`:

```typescript
export interface IMemoryStore<T> {
  tier: 'short' | 'long' | 'episodic' | 'project' | 'residual';
  add(entry: T): Promise<void>;
  query(selector: MemorySelector): Promise<T[]>;
  evict(policy: EvictionPolicy): Promise<number>;
}

export const MEMORY_TIERS = {
  short:    { ttl: 1,        unit: 'task'  },  // working context buffer
  long:     { ttl: Infinity, unit: 'forever' }, // persistent facts
  episodic: { ttl: Infinity, unit: 'forever' }, // past execution traces
  project:  { ttl: Infinity, unit: 'forever' }, // codebase knowledge
  residual: { ttl: 1,        unit: 'task'  },  // implicit trace signals
} as const;
```

The five tiers serve distinct purposes. **Short-term** holds the working context for the current task — the last few observations, the current plan, the active tool outputs. **Long-term** holds persistent facts that survive across sessions: the user's preferences, the project's conventions, the team's commit style. **Episodic** stores past execution traces so the agent can recall how it solved a similar problem before. **Project** holds indexed knowledge about the codebase itself — file structure, dependency graph, API surfaces. **Residual** captures implicit signals left in the trace that no tier explicitly claimed, so nothing is silently lost.

ADR-010 covers the vector store backing long-term and project memory (LanceDB, embedded, zero infrastructure).

---

## Hands-on example

```bash
# Once the v2 runtime ships, memory is managed per-agent
agenthood run the-developer "fix the same bug we fixed in the billing service last week"
```

The agent queries episodic memory for past billing-service fixes, retrieves the relevant trace, and applies the learned pattern. Without episodic memory, it would start from scratch:

```typescript
import { EpisodicMemory } from 'agenthood';

const episodic = new EpisodicMemory();
const prior = await episodic.query({ topic: 'billing-service-bug', limit: 3 });

// prior[0].trace — the exact steps that fixed it last time
// prior[0].outcome — what worked, what did not
```

---

## Further reading

- [ADR-010 — LanceDB for vector storage](../../docs/adr/ADR-010-lancedb-for-vector-storage.md) — the embedded store backing long-term and project memory
- [`src/memory/IMemoryStore.ts`](../../src/memory/IMemoryStore.ts) — memory store interface (v2.1.0)
- [The Cognitive Architecture for Language Agents (CoALA)](https://arxiv.org/abs/2309.02427) — the memory taxonomy paper this model derives from

---

## LinkedIn version

**Hook:** Every agent is only as good as what it remembers. Most agents remember nothing past the context window.

**Why it matters:**
- Short-term memory fills up; without compression, agents start hallucinating from overflow
- Long-term memory without governance becomes stale data poisoning fresh queries
- Agenthood's five-tier model gives each memory type its own lifecycle and retrieval path

**→** [Read the full article →](https://agenthood.flabs.tech/academy/level-2-agent-essentials/05-agent-memory/)
