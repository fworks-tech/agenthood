# Build Your First Agent

> *Reading about agents is not building agents. This is the article where you build one.*

---

## What it is

This article walks through building a `DeveloperAgent` — a working agent that extends `BaseAgent`, registers skills, and runs the ReAct loop to complete a real coding task. By the end, you will have an agent you can run, not just describe.

Building an agent comes down to four decisions: what role it plays, what skills it can use, how it reasons, and when it stops. `BaseAgent` handles the loop. You handle the role and the skills. The reasoning is ReAct. The termination is built in.

---

## Why it matters in production

The gap between understanding agents and building them is exactly one working implementation. Engineers who skip this step can explain ReAct in a whiteboard session but cannot diagnose why their agent loops forever, why it calls the wrong tool, or why it returns a result that ignores the user's actual request.

A working first agent teaches you every integration point at once: how the LLM provider is called, how skills are dispatched, how memory is read and written, how the loop decides to stop. Once you have built one, the Society's 14 members stop being abstractions — they are just `BaseAgent` subclasses with different roles and skill sets, which is exactly what ADR-004 prescribes.

---

## How Agenthood implements it

`BaseAgent` lives in `src/agents/base/BaseAgent.ts` (coming in v2.0.0). It defines the contract every Society member follows. Here is a complete, runnable `DeveloperAgent` that extends it:

```typescript
import { BaseAgent, Skill, AgentResult } from 'agenthood';

class ReadFileSkill implements Skill {
  name = 'read_file';
  description = 'Read the contents of a file at a given path.';

  async execute(args: { path: string }): Promise<string> {
    const { readFile } = await import('node:fs/promises');
    return readFile(args.path, 'utf-8');
  }
}

class WriteFileSkill implements Skill {
  name = 'write_file';
  description = 'Write content to a file at a given path.';

  async execute(args: { path: string; content: string }): Promise<string> {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(args.path, args.content, 'utf-8');
    return `Wrote ${args.content.length} chars to ${args.path}`;
  }
}

class DeveloperAgent extends BaseAgent {
  role = 'the-developer';
  skills = [new ReadFileSkill(), new WriteFileSkill()];

  // BaseAgent.run() enters the ReAct loop automatically.
  // The loop calls reason() -> act() -> observe() until complete.
}

const agent = new DeveloperAgent();
const result: AgentResult = await agent.run(
  'Read src/utils.ts, find the deprecated function, and replace it with the modern signature.'
);

console.log(result.output);
console.log(`Completed in ${result.steps} reasoning steps.`);
```

The `DeveloperAgent` class is 4 lines of real logic. `BaseAgent` and `ReActLoop` do the rest. This is the Society's design principle: the framework owns the loop, the engineer owns the role.

---

## Hands-on example

```bash
# Once the v2 runtime ships, run your custom agent directly
agenthood run the-developer "add input validation to the login handler"
```

If you want to test the pattern today, before v2.0.0, here is a minimal standalone version that uses the raw LLM API to simulate the loop:

```typescript
const llm = new GroqProvider({ model: 'llama-3.3-70b' });

const response = await llm.complete({
  system: 'You are a developer agent. Read files, propose changes, verify them.',
  user: 'Refactor the auth middleware to use async/await',
  temperature: 0.2,
});
console.log(response);
```

Expected output: a step-by-step plan, the specific files to change, and the reasoning behind each edit. The full `BaseAgent` loop automates the iteration; this standalone call shows you what one reasoning step produces.

---

## Further reading

- [ADR-005 — Orchestrator pattern](../../adr/ADR-005-orchestrator-pattern.md) — how multiple agents compose without peer-to-peer coupling
- [`src/agents/base/BaseAgent.ts`](../../src/agents/base/BaseAgent.ts) — the class to extend (v2.0.0)
- [Building agents with LLMs](https://lilianweng.github.io/posts/2023-06-23-agent/) — Lilian Weng's comprehensive breakdown


