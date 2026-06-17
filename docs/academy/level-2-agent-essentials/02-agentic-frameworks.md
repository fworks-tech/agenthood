# Agentic Frameworks

> *LangChain wraps the LLM. Agenthood wraps the engineer. The distinction matters.*

---

## What it is

An agentic framework is the scaffolding that holds an agent together: the loop, the tool registry, the memory store, the prompt assembly, the error recovery. You can build all of this from scratch on top of a raw LLM API, or you can adopt a framework that has already made the architectural decisions for you.

The landscape splits into two camps. Wrapper frameworks — LangChain, CrewAI, LangGraph — sit on top of an LLM and offer pre-built chains, agents, and graphs. You compose their abstractions and they handle the plumbing. Native runtimes — like the one Agenthood chose — build the agent loop directly in the host language, calling the LLM provider API without an intermediary abstraction layer.

The tradeoff is control versus speed-to-prototype. Wrapper frameworks get you to a demo fast. Native runtimes give you ownership of every decision that matters in production: how prompts are assembled, how errors are retried, how memory is structured, how the loop terminates.

---

## Why it matters in production

Wrapper frameworks add abstraction layers you did not choose and cannot remove. When LangChain changes its `RunnableSequence` interface, your agent breaks. When CrewAI rewrites its task delegation model, your workflow semantics shift underneath you. These are not hypothetical scenarios — they are the version-lock pattern that has burned every team that adopted a wrapper framework at scale.

The deeper problem is hidden prompts. A wrapper framework assembles your prompt from templates you never wrote, concatenated in an order you never approved. When your agent hallucinates in production, you cannot inspect the exact prompt that produced the failure because the framework built it dynamically and discarded it. Debugging becomes archaeology.

A TypeScript-native runtime solves both problems. The type system catches agent contract violations at compile time — a wrong skill signature, a missing tool method, a malformed memory entry. And because you own the prompt assembly, every prompt is a string you wrote, visible in the stack trace, diffable in git.

---

## How Agenthood implements it

Agenthood's v2 runtime is built entirely in TypeScript, living in `src/agents/`, `src/llm/`, and `src/memory/` within the existing Node.js package. There is no Python sidecar, no LangChain dependency, no external graph library. ADR-008 documents this decision and the alternatives that were rejected:

```typescript
import { GroqProvider } from './llm/GroqProvider.js';

const llm = new GroqProvider({ model: 'llama-3.3-70b' });

// Direct call — no chain, no wrapper, no hidden template
const response = await llm.complete({
  system: 'You are The Scribe. Write a Conventional Commit message.',
  user: diff,
  temperature: 0.2,
});
```

Every LLM call is a visible function call with explicit arguments. The prompt is a string you can log, diff, and unit-test. When ADR-008 superseded ADR-006 and ADR-007, the Python runtime and DeepAgents dependency were eliminated — one language, one package manager, one release pipeline.

---

## Hands-on example

Compare the two approaches on the same task — writing a commit message from a diff:

```bash
# The wrapper-framework way: a chain you cannot inspect
# const chain = prompt.from_template(...) | model | output_parser
# result = await chain.ainvoke({ diff })  # what prompt? what params?

# The Agenthood way: explicit, inspectable, typed
agenthood run the-scribe "write a commit message for the current diff"
```

The Society member produces a Conventional Commit message with no hidden prompt assembly. The skill file (`members/the-scribe/the-scribe.md`) is the prompt — readable, versioned, and editable.

---

## Further reading

- [ADR-008 — TypeScript-native runtime over Python](../../docs/adr/ADR-008-typescript-runtime-over-python.md) — the decision and its alternatives
- [ADR-007 — DeepAgents superseded](../../docs/adr/ADR-007-deepagents-as-execution-engine.md) — the execution engine that was eliminated
- [LangChain concepts](https://python.langchain.com/docs/concepts/) — what LangChain covers well and where it adds overhead

---

## LinkedIn version

**Hook:** Every "ship fast" framework eventually makes you ship slow. Agenthood is designed so the framework never becomes the bottleneck.

**Why it matters:**
- Wrappers add abstraction layers you did not choose and cannot remove
- TypeScript-native means the type system catches agent contract violations at compile time
- Agenthood builds the runtime it needs — no upstream dependency waiting to break you

**→** [Read the full article →](https://agenthood.flabs.tech/academy/level-2-agent-essentials/02-agentic-frameworks/)
