# Agentic RAG

> *Passive RAG always retrieves. Agentic RAG decides. The agent that decides is the one that ships.*

---

## What it is

Retrieval-Augmented Generation (RAG) comes in two flavors, and confusing them is the most expensive misunderstanding in the agent space.

**Passive RAG** retrieves unconditionally. Every user query triggers the same pipeline: embed the query, search the vector store, inject the top-K chunks into the prompt, generate. Retrieval is not a decision — it is a reflex. The model never gets to say "I already know this" or "this question does not need retrieval" or "the vector store is the wrong source here."

**Agentic RAG** treats retrieval as a decision the agent makes. The agent looks at the query, considers what it already knows, considers what sources are available, and decides: retrieve now, retrieve from a different source, or skip retrieval entirely because the answer is already in context. Retrieval becomes a tool the agent calls when it judges it necessary — not a pipeline that runs regardless.

The architectural difference is where the retrieval logic lives. In passive RAG, it lives in a hardcoded pipeline before the LLM. In Agentic RAG, it lives *inside* the agent's reasoning loop, as a `RetrievalDecisionSkill` the agent invokes like any other tool. This is why Agentic RAG is a Level 2 concept, not Level 1 — it requires the agent loop from article 01 and the multi-step reasoning from article 07.

---

## Why it matters in production

Passive RAG adds latency and cost on every query, including the ones that do not need it. "What is 2+2?" hits the vector store. "Summarize this file I just pasted" hits the vector store. At 1000 queries a day, that is 1000 unnecessary embeddings, 1000 unnecessary similarity searches, and 1000 prompts bloated with irrelevant chunks. The cost compounds, and the latency is user-visible.

Worse, passive RAG retrieves the wrong source for questions that need a different retrieval strategy. A question about "how do these two files relate?" needs a graph traversal, not a vector similarity search. A question about "what is the latest API signature?" needs a fresh code read, not a stale embedding. Passive RAG cannot adapt — it has one mode, and that mode is always-on vector search.

Agentic RAG solves both. The agent skips retrieval when the answer is in context. It routes to a graph store when the question is about relationships. It reads the file directly when the question is about current state. And it attaches provenance to every answer — which source, which chunk, which retrieval path — so you can audit why the agent said what it said.

---

## How Agenthood implements it

The two components are `AgenticRAG` and `RetrievalDecisionSkill`, both in `src/rag/` and `src/skills/rag/` (coming in v2.1.0):

```typescript
import { AgenticRAG, RetrievalDecisionSkill } from 'agenthood';

const agenticRag = new AgenticRAG({
  sources: {
    vector:   lanceVectorStore,    // semantic similarity
    graph:    codeGraphStore,      // structural relationships
    directly: fileSystemReader,    // fresh file reads
  },
  decision: new RetrievalDecisionSkill(),
});

// The agent decides — it does not reflexively retrieve
const answer = await agenticRag.query('How does BaseAgent relate to ReActLoop?');
// decision: "relationship question → route to graph store"
// retrieval: graphStore.query('BaseAgent', 'ReActLoop')
// answer: "BaseAgent.run() delegates to ReActLoop.execute() — see src/agents/base/BaseAgent.ts:12"
```

The `RetrievalDecisionSkill` is what makes it agentic. It inspects the query, the current context, and the available sources, and emits a routing decision: `retrieve:vector`, `retrieve:graph`, `retrieve:direct`, or `skip`. The `AgenticRAG` orchestrator executes the decision and attaches provenance to the result.

---

## Hands-on example

```bash
# Once the v2 runtime ships, Agentic RAG runs through the agent loop
agenthood run the-developer "how does the auth middleware connect to the rate limiter?"
```

Watch the agent decide its retrieval strategy:

```
[think] This is a relationship question between two components.
[decide] route: graph store (not vector — relationships are structural)
[act]  graph.query('auth-middleware', 'rate-limiter')
[see]  auth-middleware calls rate-limiter.check() on line 47
[think] I have the answer — no need for additional retrieval.
[done] auth-middleware → rate-limiter.check() at src/middleware/auth.ts:47
       provenance: graph-store, 1 hop, confidence 0.96
```

Contrast with passive RAG, which would have embedded the query, hit the vector store, returned 5 loosely-related chunks about "middleware," and produced a vaguer answer at higher cost.

---

## Further reading

- [`src/rag/AgenticRAG.ts`](../../src/rag/AgenticRAG.ts) — agentic retrieval orchestration (v2.1.0)
- [`src/skills/rag/RetrievalDecisionSkill.ts`](../../src/skills/rag/RetrievalDecisionSkill.ts) — the routing decision skill (v2.1.0)
- [Self-RAG: Learning to Retrieve, Generate, and Critique through Self-Reflection](https://arxiv.org/abs/2310.11511) — the foundational Agentic RAG paper

---

## LinkedIn version

**Hook:** Passive RAG retrieves whether it needs to or not. At 1000 queries a day, that is a lot of unnecessary tokens.

**Why it matters:**
- Always-retrieve adds latency and cost even when the answer is already in context
- Smart retrieval routing (vector vs graph vs skip) matches the tool to the question
- Agenthood's `AgenticRAG` attaches provenance to every answer — you know exactly what was used

**→** [Read the full article →](https://agenthood.flabs.tech/academy/level-2-agent-essentials/09-agentic-rag/)
