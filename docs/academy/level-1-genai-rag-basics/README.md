# Level 1 — GenAI & RAG Basics

> *Every agent that fails in production failed because its builder skipped this level.*

Nine articles. The foundation. Start here.

---

## Articles

| # | Article | Agenthood Component |
|---|---------|---------------------|
| 1 | [Generative AI Introduction](01-generative-ai-introduction.md) | The Society's position in the GenAI ecosystem |
| 2 | [Basics of LLMs](02-basics-of-llms.md) | `ILLMProvider`, 4 providers |
| 3 | [Prompt Engineering](03-prompt-engineering.md) | `PromptBuilder`, member `.md` templates |
| 4 | [LLM Parameters](04-llm-parameters.md) | `LLMRequest` type |
| 5 | [Chunking Strategies](05-chunking-strategies.md) | `ChunkStrategy`, `HierarchicalChunkStrategy` |
| 6 | [RAG Fundamentals](06-rag-fundamentals.md) | `Retriever`, `Indexer`, `Embedder` |
| 7 | [Vector Databases](07-vector-databases.md) | `VectorStore` (LanceDB), ADR-010 |
| 8 | [API Wrappers](08-api-wrappers.md) | `ILLMProvider` as abstraction pattern |
| 9 | [Tool Integration](09-tool-integration.md) | `ISkill`, `SkillRegistry`, `ReActLoop` |

---

## What Level 1 covers

The nine concepts every developer must understand before building agents. These are not theory — each one maps to a component in Agenthood that implements it, enforces it, or fails loudly when it's missing.

Finish Level 1, then go to [Level 2 — AI Agent Essentials](../level-2-agent-essentials/README.md).
