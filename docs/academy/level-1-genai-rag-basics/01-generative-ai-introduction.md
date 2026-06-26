# Generative AI Introduction

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

The `ILLMProvider` interface is implemented at `src/llm/ILLMProvider.ts` (shipped in v2.0.0):

```typescript
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

- [ADR-001 — Markdown skills over code agents](../../adr/ADR-001-markdown-skills-over-code-agents.md)
- [`AGENTS.md`](https://github.com/fworks-tech/agenthood/blob/main/AGENTS.md) — Society overview
- [Attention Is All You Need](https://arxiv.org/abs/1706.03762) — the transformer paper that started this


