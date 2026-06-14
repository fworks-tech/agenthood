import os

articles = {
    "01-generative-ai-introduction.md": """# Generative AI Introduction

> Generative AI without standards is just automated chaos. The Society enforces the standards.

---

## What it is

Generative AI refers to algorithms (such as LLMs, image generators, and audio synthesis models) that can create new content based on training data. In the context of the Agenthood, it specifically means Large Language Models (LLMs) that process text to perform reasoning, code generation, and task execution.

Unlike deterministic software, Generative AI is probabilistic. You do not write a sequence of `if/else` statements to get a result; you provide a prompt, and the model predicts the most likely next tokens. It is an engine of probability, and it requires a new mental model for development.

---

## Why it matters in production

If you treat a Generative AI model like a deterministic function, your system will fail. You will encounter hallucinations, non-deterministic output, and silent failures where the model returns confident but incorrect results.

In production, Generative AI cannot be deployed naked. It must be wrapped in guardrails, verification loops, and strict contracts. Without these, your agent will confidently corrupt data, break builds, or leak context. The Society prevents this by replacing magic boxes with strict agentic contracts.

---

## How Agenthood implements it

Agenthood is not another LLM wrapper; it is a framework of conventions. It places Generative AI within the `ILLMProvider` abstraction, ensuring that the model is only a cog in a larger, deterministic machine.

This architecture is currently being finalized for a future milestone. It will reside in `src/llm/ILLMProvider.ts`:

```typescript
// Planned for a future milestone
export interface ILLMProvider {
  generate(prompt: string, options: LLMRequest): Promise<string>;
  verify(response: string, contract: Contract): boolean;
}
```

The Society restricts the chaos of Generative AI behind these firm boundaries.

---

## Hands-on example

While the formal `ILLMProvider` is under construction, you can invoke the Society's existing agents to see disciplined Generative AI in action:

```bash
# Ask The Scribe to write a commit message
npx agenthood run the-scribe "Write a commit message for the staged changes"
```

The agent will strictly follow the Conventional Commits standard, proving that Generative AI can be constrained to produce reliable output.

---

## Further reading

- [ADR-001 — Markdown skills over code agents](../../docs/adr/ADR-001-markdown-skills-over-code-agents.md)
- [`AGENTS.md`](../../AGENTS.md) — Society overview
- [Attention Is All You Need](https://arxiv.org/abs/1706.03762) — the transformer paper that started this

---

## LinkedIn version

**Hook:** Generative AI without standards is just automated chaos. The Society enforces the standards.

**Why it matters:**
- Magic boxes fail in ways you cannot debug
- Generative AI is probabilistic and prone to hallucination
- Wrapping models in strict contracts keeps your agents fixable

**→** [Read the full article + implementation walkthrough →](https://fworks-tech.github.io/agenthood/academy/level-1-genai-rag-basics/01-generative-ai-introduction/)
""",

    "02-basics-of-llms.md": """# Basics of LLMs

> An LLM is not a brain; it is an incredibly powerful token calculator. Treat it accordingly.

---

## What it is

A Large Language Model (LLM) is a neural network trained on vast amounts of text data to predict the next word (or "token") in a sequence. When you give it a prompt, it calculates the highest-probability continuation based on the patterns it learned during training.

It does not "think" or "know" facts in a human sense. It maps statistical relationships between concepts. Understanding this probabilistic nature is essential for building robust agents, as it explains why models can hallucinate, get confused by poor formatting, or require specific phrasing to perform well.

```mermaid
graph LR
    A[Input Prompt] --> B[Tokenization]
    B --> C[Transformer Layers]
    C --> D[Probability Distribution]
    D --> E[Next Token Selection]
    E --> F[Output Text]
```

---

## Why it matters in production

If you assume an LLM is a reasoning engine with perfect recall, you will design fragile systems. Because they are probabilistic, LLMs will confidently invent APIs, hallucinate facts, or drift away from instructions if the context window gets too noisy.

In production, you cannot rely on an LLM to self-correct without explicit instruction. You must design fallback mechanisms, retry loops, and validation steps. A raw LLM is a vulnerability; an LLM governed by a strict state machine is a tool.

---

## How Agenthood implements it

Agenthood abstracts the complexities of LLMs behind the `ILLMProvider` interface, allowing you to swap between the 4 major providers (Anthropic, OpenAI, Google, and local models) without rewriting your agent logic.

This is planned for a future milestone and will live in `src/llm/ILLMProvider.ts`:

```typescript
// Planned for a future milestone
export interface ILLMProvider {
  /**
   * Generates a completion using the specified provider.
   */
  complete(request: LLMRequest): Promise<LLMResponse>;
}
```

By forcing all LLMs through a unified interface, Agenthood ensures that provider-specific quirks do not pollute the core logic of the Society's members.

---

## Hands-on example

To see how the Society interacts with LLMs under the hood, you can inspect the configuration of an existing member:

```bash
# Check the active members and their current configuration
npx agenthood check
```

Or in TypeScript (future milestone):

```typescript
import { AnthropicProvider } from '@agenthood/llm';

const provider = new AnthropicProvider({ apiKey: process.env.ANTHROPIC_API_KEY });
const response = await provider.complete({ prompt: 'Explain the Society.' });
```

---

## Further reading

- [ADR-005 — Orchestrator pattern](../../docs/adr/ADR-005-orchestrator-pattern.md)
- [`src/llm/ILLMProvider.ts`](../../src/llm/ILLMProvider.ts) — source implementation (planned)
- [Anthropic: Introduction to Prompting](https://docs.anthropic.com/en/docs/intro-to-prompting) — excellent foundational knowledge

---

## LinkedIn version

**Hook:** An LLM is not a brain; it is an incredibly powerful token calculator. Treat it accordingly.

**Why it matters:**
- LLMs are probabilistic token predictors, not logic engines
- Without guardrails, they will confidently hallucinate APIs and facts
- Provider abstraction lets you swap models when one inevitably degrades

**→** [Read the full article + implementation walkthrough →](https://fworks-tech.github.io/agenthood/academy/level-1-genai-rag-basics/02-basics-of-llms/)
""",

    "03-prompt-engineering.md": """# Prompt Engineering

> A poor prompt is a failure of leadership. The Society demands clarity.

---

## What it is

Prompt engineering is the discipline of structuring text so an LLM understands exactly what you want, how to format it, and what constraints to follow. It is the UI of the generative AI world.

Effective prompting relies on clear context, specific instructions, and formatted output schemas (like JSON or XML). It is not about "tricking" the model; it is about providing the precise statistical context the model needs to navigate its latent space toward the correct answer.

```mermaid
graph TD
    A[Role/Persona] --> B[Task Definition]
    B --> C[Context/Input Data]
    C --> D[Formatting Rules]
    D --> E[Final Prompt]
```

---

## Why it matters in production

If your prompts are vague, the LLM will guess your intent. In a chat interface, a bad guess is annoying. In an autonomous agent, a bad guess means the agent deletes the wrong file, misinterprets code, or enters an infinite loop.

Production prompt engineering prevents context degradation. It ensures the model's output can be safely parsed by downstream code, dramatically reducing `JSON.parse` errors and unpredictable state transitions.

---

## How Agenthood implements it

Agenthood implements prompt engineering through the `PromptBuilder` utility and the strict Markdown templates defining its members (`members/*/*.md`). 

The `PromptBuilder` (planned for a future milestone in `src/llm/PromptBuilder.ts`) constructs structured prompts programmatically:

```typescript
// Planned for a future milestone
const prompt = new PromptBuilder()
  .setSystem(member.systemPrompt)
  .addContext(codeDiff)
  .setInstruction('Review this diff for security flaws.')
  .requireFormat('json')
  .build();
```

Instead of chaotic string concatenation, Agenthood uses typed builders and rigid templates to guarantee prompt integrity.

---

## Hands-on example

You can view the Society's mastery of prompt engineering by reading any of the member files.

```bash
# Read The Reviewer's strict prompt instructions
cat members/the-reviewer/the-reviewer.md
```

Or programmatically (future milestone):

```typescript
import { PromptBuilder } from '@agenthood/llm';

const p = new PromptBuilder().setInstruction('Do not hallucinate.').build();
```

---

## Further reading

- [ADR-001 — Markdown skills over code agents](../../docs/adr/ADR-001-markdown-skills-over-code-agents.md)
- [`src/llm/PromptBuilder.ts`](../../src/llm/PromptBuilder.ts) — source implementation (planned)
- [OpenAI: Prompt Engineering Guide](https://platform.openai.com/docs/guides/prompt-engineering) — best practices for structuring prompts

---

## LinkedIn version

**Hook:** A poor prompt is a failure of leadership. The Society demands clarity.

**Why it matters:**
- Vague prompts force LLMs to guess, and LLM guesses break production
- Well-engineered prompts ensure parseable, deterministic outputs
- Building prompts programmatically prevents context degradation

**→** [Read the full article + implementation walkthrough →](https://fworks-tech.github.io/agenthood/academy/level-1-genai-rag-basics/03-prompt-engineering/)
""",

    "04-llm-parameters.md": """# LLM Parameters

> If you leave `temperature` at its default, you are surrendering control of your application's entropy.

---

## What it is

LLM parameters are the configuration knobs you pass to the API to alter how the model selects the next token. The most critical parameters are:

- **Temperature:** Controls randomness. `0.0` means strictly deterministic (always picking the highest probability token); `1.0` allows more creative, varied choices.
- **Top P (Nucleus Sampling):** Restricts token selection to a subset of tokens whose cumulative probability reaches `P`. It acts as a dynamic cutoff for wild guesses.
- **Frequency/Presence Penalty:** Penalizes tokens based on how often they have already appeared in the text, preventing repetitive loops.

---

## Why it matters in production

Leaving these parameters unconfigured is reckless. A coding agent running at `temperature: 1.0` will eventually invent syntax that does not exist. A creative writing agent running at `temperature: 0.0` will produce robotic, lifeless text.

In production, mismatched parameters lead to unstable agents. If you need JSON output, high entropy will cause formatting errors. You must explicitly configure these parameters based on the specific cognitive task the agent is performing.

---

## How Agenthood implements it

Agenthood defines strict parameter boundaries within the `LLMRequest` type. Every call to an `ILLMProvider` must declare its parameters.

This ensures agents cannot accidentally run amok. It will be implemented in `src/llm/types.ts` (future milestone):

```typescript
// Planned for a future milestone
export interface LLMRequest {
  prompt: string;
  temperature: number; // 0.0 for strict tasks, 0.7 for creative tasks
  topP?: number;
  maxTokens?: number;
  stopSequences?: string[];
}
```

The Society does not guess. It sets `temperature: 0` for operations like The Doorman's commit validation to guarantee absolute determinism.

---

## Hands-on example

You can configure these parameters directly when initializing the runtime layer.

```bash
# Agenthood runtime defaults to low temperature for code tasks
agenthood-run invoke the-scribe "Write a commit" --temperature 0.1
```

Or in TypeScript (future milestone):

```typescript
import { LLMRequest } from '@agenthood/llm';

const strictRequest: LLMRequest = {
  prompt: 'Format this data as JSON.',
  temperature: 0.0,
  maxTokens: 1000
};
```

---

## Further reading

- [ADR-006 — Python runtime as additive layer](../../docs/adr/ADR-006-python-runtime-as-additive-layer.md)
- [`src/llm/types.ts`](../../src/llm/types.ts) — source implementation (planned)
- [Cohere: Parameters Guide](https://docs.cohere.com/docs/temperature-top-p-and-top-k) — how sampling parameters mathematically work

---

## LinkedIn version

**Hook:** If you leave `temperature` at its default, you are surrendering control of your application's entropy.

**Why it matters:**
- High temperature coding agents invent fake syntax
- Low temperature creative agents sound like robots
- Explicit parameter configuration prevents formatting errors in JSON outputs

**→** [Read the full article + implementation walkthrough →](https://fworks-tech.github.io/agenthood/academy/level-1-genai-rag-basics/04-llm-parameters/)
""",

    "05-chunking-strategies.md": """# Chunking Strategies

> Poor chunking quietly destroys retrieval quality. The Society does not tolerate quiet destruction.

---

## What it is

Chunking is the process of breaking a large document into smaller, manageable pieces before embedding and storing them in a vector database. Because LLMs have context window limits and embedding models have maximum token constraints, you cannot process a 1,000-page manual all at once.

A chunking strategy determines *how* to break the text. You can split by character count, by word, by paragraph, or by semantic structure (like Markdown headers or code functions). 

```mermaid
graph TD
    A[Large Document] --> B{Chunking Strategy}
    B -->|Fixed Size| C[Chunk 1: 500 tokens]
    B -->|Fixed Size| D[Chunk 2: 500 tokens]
    B -->|Semantic| E[Chunk 1: Function A]
    B -->|Semantic| F[Chunk 2: Function B]
```

---

## Why it matters in production

If you blindly chop text every 500 characters, you will split sentences in half and sever code blocks from their declarations. When the retriever fetches that chunk later, the LLM will lack the necessary context to answer the user's question, leading to hallucinations.

In production, bad chunking is the number one cause of RAG failure. A smart `HierarchicalChunkStrategy` ensures that the semantic meaning of the text is preserved, drastically improving the accuracy of vector search.

---

## How Agenthood implements it

Agenthood plans to implement chunking via the `ChunkStrategy` interface, specifically utilizing a `HierarchicalChunkStrategy` for code and markdown parsing.

This will be found in `src/rag/ChunkStrategy.ts` (future milestone):

```typescript
// Planned for a future milestone
export interface ChunkStrategy {
  chunk(text: string, metadata: FileMetadata): DocumentChunk[];
}

export class HierarchicalChunkStrategy implements ChunkStrategy {
  // Splits Markdown by H1, H2, H3 or Code by class/function
}
```

The Society understands that code cannot be split arbitrarily. A function must remain whole.

---

## Hands-on example

Though the formal pipeline is under development, you can test semantic chunking concepts using standard text processing:

```bash
# A future command to test chunking
agenthood run rag:chunk README.md --strategy semantic
```

Or conceptually in TypeScript:

```typescript
// Example of a naive vs semantic split
const text = "export class Agent { ... }";
// Bad: text.slice(0, 10) -> "export cla"
// Good: extract syntax tree node
```

---

## Further reading

- [ADR-010 — RAG Architecture (Planned)](../../docs/adr/ADR-010-rag-architecture.md)
- [`src/rag/ChunkStrategy.ts`](../../src/rag/ChunkStrategy.ts) — source implementation (planned)
- [Pinecone: Chunking Strategies](https://www.pinecone.io/learn/chunking-strategies/) — an excellent breakdown of chunking methods

---

## LinkedIn version

**Hook:** Poor chunking quietly destroys retrieval quality. The Society does not tolerate quiet destruction.

**Why it matters:**
- Blindly chopping text destroys context
- Splitting a code block in half makes it unreadable for the LLM
- Semantic chunking preserves meaning and rescues RAG pipelines

**→** [Read the full article + implementation walkthrough →](https://fworks-tech.github.io/agenthood/academy/level-1-genai-rag-basics/05-chunking-strategies/)
""",

    "06-rag-fundamentals.md": """# RAG Fundamentals

> An agent without a retrieval pipeline is just a confidently loud amnesiac. 

---

## What it is

Retrieval-Augmented Generation (RAG) is a pattern that gives an LLM access to external knowledge it was not trained on. Instead of relying purely on its internal weights, the system:

1. **Retrieves** relevant information from a database based on the user's query.
2. **Augments** the prompt by injecting that retrieved information into the context window.
3. **Generates** the final answer using the newly provided facts.

```mermaid
sequenceDiagram
    User->>System: Query
    System->>Vector DB: 1. Retrieve related chunks
    Vector DB-->>System: Top K results
    System->>LLM: 2. Augment prompt with chunks
    LLM-->>System: 3. Generate response
    System-->>User: Final Answer
```

---

## Why it matters in production

LLMs have a static knowledge cutoff and cannot access your private codebase, Slack messages, or documentation. If you ask an agent to "debug the billing service," it will hallucinate unless it can read the billing service code.

RAG grounds the LLM in reality. In production, RAG prevents hallucinations, allows for citation of sources, and enables agents to act on proprietary data without requiring expensive model fine-tuning.

---

## How Agenthood implements it

Agenthood's planned RAG architecture is built around three core components: the `Indexer` (for ingesting files), the `Embedder` (for vectorizing them), and the `Retriever` (for fetching context).

These components will reside in `src/rag/Retriever.ts` and `src/rag/Indexer.ts` (future milestone):

```typescript
// Planned for a future milestone
export class Retriever {
  constructor(private vectorStore: VectorStore, private embedder: Embedder) {}

  async retrieveContext(query: string): Promise<DocumentChunk[]> {
    const vector = await this.embedder.embed(query);
    return this.vectorStore.search(vector, { topK: 5 });
  }
}
```

The Society retrieves facts before it speaks.

---

## Hands-on example

Once the RAG module is fully implemented in a future milestone, you will be able to index and query your repository directly:

```bash
# Index the current repository
agenthood run rag:index .

# Query the codebase
agenthood run rag:query "Where is the orchestrator defined?"
```

Or in TypeScript (future milestone):

```typescript
const context = await retriever.retrieveContext("Explain the orchestrator");
const prompt = `Use this context: ${context}\n\nExplain the orchestrator.`;
```

---

## Further reading

- [ADR-010 — RAG Architecture (Planned)](../../docs/adr/ADR-010-rag-architecture.md)
- [`src/rag/Retriever.ts`](../../src/rag/Retriever.ts) — source implementation (planned)
- [IBM: What is RAG?](https://research.ibm.com/blog/retrieval-augmented-generation-RAG) — foundational overview of the RAG pattern

---

## LinkedIn version

**Hook:** An agent without a retrieval pipeline is just a confidently loud amnesiac.

**Why it matters:**
- LLMs don't know your private codebase or company docs
- Fine-tuning is expensive and slow; RAG is fast and factual
- RAG grounds the LLM in reality and forces it to cite its sources

**→** [Read the full article + implementation walkthrough →](https://fworks-tech.github.io/agenthood/academy/level-1-genai-rag-basics/06-rag-fundamentals/)
""",

    "07-vector-databases.md": """# Vector Databases

> Keyword search finds the words you typed. Vector search finds the meaning you intended.

---

## What it is

A Vector Database is a specialized storage system designed to hold high-dimensional mathematical representations of data (vectors or embeddings). When text is converted into an embedding, words with similar semantic meanings are placed closer together in mathematical space.

Unlike relational databases (SQL) that rely on exact keyword matches, vector databases perform "similarity searches." If you search for "dog," it will return documents about "puppies" and "canines" because their vectors are grouped near each other.

---

## Why it matters in production

Traditional search fails when users ask natural language questions ("How do I fix the auth bug?"). RAG pipelines require the ability to retrieve documents based on semantic relevance, not exact text matches.

In production, vector databases provide the blazing-fast similarity search that makes real-time agentic workflows possible. Without them, comparing a query against thousands of codebase chunks would be computationally paralyzing.

---

## How Agenthood implements it

Agenthood implements vector storage using LanceDB, an embedded, high-performance vector database that requires no external infrastructure. This aligns with the Society's principle of lightweight, local-first tooling.

This integration will be managed via the `VectorStore` interface in `src/rag/VectorStore.ts` (future milestone, outlined in ADR-010):

```typescript
// Planned for a future milestone
import * as lancedb from 'vectordb';

export class LanceDBStore implements VectorStore {
  async search(queryVector: number[], options: SearchOptions) {
    const table = await this.db.openTable('codebase');
    return await table.search(queryVector).limit(options.topK).execute();
  }
}
```

No heavy cloud infrastructure. No external dependencies. Just fast, local semantic search.

---

## Hands-on example

When the RAG tools are introduced, you will interact with the local vector store transparently:

```bash
# Initialize local vector storage
agenthood run rag:init-db

# The database lives in .agenthood/vectors/
ls -la .agenthood/vectors/
```

Or conceptually in TypeScript:

```typescript
// The local embedded nature of LanceDB makes this seamless
const db = new LanceDBStore('.agenthood/vectors');
await db.insert(chunks);
```

---

## Further reading

- [ADR-010 — RAG Architecture (Planned)](../../docs/adr/ADR-010-rag-architecture.md)
- [`src/rag/VectorStore.ts`](../../src/rag/VectorStore.ts) — source implementation (planned)
- [LanceDB Documentation](https://lancedb.github.io/lancedb/) — why embedded vector DBs are the future

---

## LinkedIn version

**Hook:** Keyword search finds the words you typed. Vector search finds the meaning you intended.

**Why it matters:**
- Users ask natural language questions, not exact keyword queries
- Vector DBs allow agents to find related concepts instantly
- Embedded vector DBs like LanceDB keep your architecture lightweight and local

**→** [Read the full article + implementation walkthrough →](https://fworks-tech.github.io/agenthood/academy/level-1-genai-rag-basics/07-vector-databases/)
""",

    "08-api-wrappers.md": """# API Wrappers

> Hardcoding to the OpenAI API is a technical debt time bomb. The Society abstracts the provider.

---

## What it is

An API Wrapper is a layer of abstraction between your application code and the external LLM provider's API (like OpenAI, Anthropic, or Google Gemini). Instead of calling `fetch('https://api.openai.com/v1/chat/completions')` directly throughout your codebase, you call a standardized internal method.

The wrapper handles provider-specific SDK logic, authentication, error handling, rate limiting, and response parsing, presenting a clean, unified contract to the rest of the application.

---

## Why it matters in production

The AI landscape changes weekly. Today's state-of-the-art model is tomorrow's legacy fallback. If your agent's logic is tightly coupled to Anthropic's SDK, migrating to a cheaper, faster local model requires a massive rewrite.

In production, API Wrappers prevent vendor lock-in. They also provide a central chokepoint to implement critical features like retry logic, telemetry logging, and fallback routing (e.g., if OpenAI goes down, automatically route to Gemini).

---

## How Agenthood implements it

Agenthood achieves this via the `ILLMProvider` interface. It defines a strict contract that all provider implementations (OpenAI, Anthropic, etc.) must adhere to.

This pattern will live in `src/llm/ILLMProvider.ts` (future milestone):

```typescript
// Planned for a future milestone
export interface ILLMProvider {
  complete(request: LLMRequest): Promise<LLMResponse>;
}

// Anthropic and OpenAI implementations both satisfy the interface
export class AnthropicProvider implements ILLMProvider { ... }
export class OpenAIProvider implements ILLMProvider { ... }
```

The Society does not care who generates the tokens, as long as the contract is respected.

---

## Hands-on example

Because of this abstraction, switching the active model for an agent is a configuration change, not a code change.

```bash
# Switch the runtime provider seamlessly
agenthood-run invoke the-scribe "Write a commit" --provider anthropic
agenthood-run invoke the-scribe "Write a commit" --provider openai
```

Or in TypeScript (future milestone):

```typescript
// The orchestrator doesn't care which provider is passed
const provider = config.useLocal ? new LocalProvider() : new AnthropicProvider();
const agent = new Agent(provider);
```

---

## Further reading

- [ADR-005 — Orchestrator pattern](../../docs/adr/ADR-005-orchestrator-pattern.md)
- [`src/llm/ILLMProvider.ts`](../../src/llm/ILLMProvider.ts) — source implementation (planned)
- [Martin Fowler: Gateway Pattern](https://martinfowler.com/articles/gateway-pattern.html) — the architectural basis for API wrappers

---

## LinkedIn version

**Hook:** Hardcoding to the OpenAI API is a technical debt time bomb. The Society abstracts the provider.

**Why it matters:**
- The AI landscape changes weekly; vendor lock-in is dangerous
- Abstractions allow seamless fallback if an API goes down
- You can route simple tasks to cheap models and complex tasks to expensive ones

**→** [Read the full article + implementation walkthrough →](https://fworks-tech.github.io/agenthood/academy/level-1-genai-rag-basics/08-api-wrappers/)
""",

    "09-tool-integration.md": """# Tool Integration

> Agents that cannot plan cannot be trusted. Agents that cannot act are just chatbots. Planning and acting requires tools.

---

## What it is

Tool Integration (also known as Function Calling) is the mechanism that allows an LLM to interact with the outside world. Instead of just returning text, the model can return a structured request to execute a specific function—such as reading a file, querying a database, or triggering a CI pipeline.

This is powered by the ReAct (Reasoning and Acting) loop: the agent observes its environment, reasons about what to do next, executes a tool, observes the result, and loops until the goal is achieved.

```mermaid
graph TD
    A[User Request] --> B[Agent Reasons]
    B --> C{Needs Tool?}
    C -->|Yes| D[Call Tool e.g., read_file]
    D --> E[Observe Output]
    E --> B
    C -->|No| F[Final Answer]
```

---

## Why it matters in production

Without tools, an LLM is isolated in a sandbox. It cannot verify if code compiles, it cannot read a Slack message, and it cannot commit to a repository. 

In production, agents must take action. But blindly allowing an LLM to execute code is a massive security risk. Tools provide the strict, typed boundary where the LLM's requested actions are validated, scoped, and executed safely by your application logic.

---

## How Agenthood implements it

Agenthood implements this via the `ISkill` interface, managed by the `SkillRegistry`, and executed within a `ReActLoop`.

This allows members of the Society to seamlessly utilize tools. The architecture will reside in `src/agent/ISkill.ts` (future milestone):

```typescript
// Planned for a future milestone
export interface ISkill {
  name: string;
  description: string;
  schema: JSONSchema;
  execute(args: any): Promise<string>;
}

export class SkillRegistry {
  register(skill: ISkill): void;
  getAvailableTools(): ToolDefinition[];
}
```

The Society demands that all actions are defined by a strict `JSONSchema` contract.

---

## Hands-on example

When the runtime is active, you can provide tools directly to an agent:

```bash
# Invoke an agent and provide it with filesystem skills
agenthood-run invoke the-architect "Draft an ADR" --tools fs-write,fs-read
```

Or in TypeScript (future milestone):

```typescript
const registry = new SkillRegistry();
registry.register(new FileReadSkill());

const loop = new ReActLoop(provider, registry);
await loop.run("Read the package.json and summarize dependencies.");
```

---

## Further reading

- [ADR-006 — Python runtime as additive layer](../../docs/adr/ADR-006-python-runtime-as-additive-layer.md)
- [`src/agent/ISkill.ts`](../../src/agent/ISkill.ts) — source implementation (planned)
- [ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629) — the foundational paper on tool use

---

## LinkedIn version

**Hook:** Agents that cannot act are just chatbots. Planning and acting requires tools.

**Why it matters:**
- Without tools, LLMs are isolated in a sandbox
- Function calling lets agents read files, hit APIs, and trigger CI pipelines
- Tool registries provide a secure boundary between LLM reasoning and system execution

**→** [Read the full article + implementation walkthrough →](https://fworks-tech.github.io/agenthood/academy/level-1-genai-rag-basics/09-tool-integration/)
"""
}

for filename, content in articles.items():
    filepath = os.path.join("docs/academy/level-1-genai-rag-basics", filename)
    with open(filepath, "w") as f:
        f.write(content)

print("Created 9 articles successfully.")
