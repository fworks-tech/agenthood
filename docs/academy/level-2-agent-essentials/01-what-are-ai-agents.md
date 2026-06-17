# What Are AI Agents

> *An LLM answers questions. An agent solves problems. The difference is a loop, a memory, and a set of tools.*

---

## What it is

An AI agent is a system that perceives input, reasons about it, takes action, and observes the result — then repeats until the problem is solved. The keyword is *repeats*. A single LLM call is one shot. An agent is a loop.

Every agent shares the same skeleton: observe the user's request, reason about what to do next, execute an action (call a tool, write code, query a database), observe the result of that action, and feed it back into the next reasoning step. This is the ReAct pattern — Reason + Act — and it is the architecture that separates agents from chatbots.

The three components that make the loop useful are tools, memory, and termination. Tools let the agent affect the world outside its context window. Memory lets it carry context across iterations and across sessions. Termination logic decides when the problem is solved and the loop can stop. Strip any of these away and you no longer have an agent — you have a stateless function that talks like one.

---

## Why it matters in production

A chatbot answers "how do I fix this bug?" with a plausible paragraph. An agent reads the actual code, runs the failing test, proposes a fix, and verifies it passes. The difference is not academic — it is the difference between a demo and a deployable system.

The failure mode of a chatbot is hallucination: it sounds right and is wrong. The failure mode of a badly built agent is worse: it takes real actions based on wrong reasoning. An agent that deletes a file, merges a PR, or sends a message based on a hallucinated plan causes damage a chatbot never could.

This is why the loop must be observable. Each reasoning step and each action must be logged, inspectable, and interruptible. An agent you cannot watch is an agent you cannot trust. The Society treats observability as a non-negotiable property of the agent loop, not a feature to add later.

---

## How Agenthood implements it

Agenthood's agent architecture is built on two primitives: `BaseAgent` and `ReActLoop`. Every Society member — The Scribe, The Architect, The Reviewer — extends `BaseAgent` and runs its reasoning through `ReActLoop`. These components land in `src/agents/base/BaseAgent.ts` and `src/reasoning/ReActLoop.ts` (coming in v2.0.0):

```typescript
export abstract class BaseAgent {
  abstract role: string;
  abstract skills: Skill[];

  async run(task: string): Promise<AgentResult> {
    return new ReActLoop(this).execute(task);
  }
}

export class ReActLoop {
  async execute(task: string): Promise<AgentResult> {
    let observation = task;
    while (!this.isComplete(observation)) {
      const thought = await this.reason(observation);
      const action  = await this.act(thought);
      observation  = await this.observe(action);
    }
    return this.finalize();
  }
}
```

`BaseAgent` defines the contract — a role, a set of skills, and a `run()` entry point. `ReActLoop` implements the observe-reason-act cycle. The loop terminates when the agent's reasoning produces a completion signal rather than another action. ADR-004 explains why Agenthood uses 14 specialized `BaseAgent` subclasses instead of one general-purpose agent.

---

## Hands-on example

The simplest way to see an agent in action is the Society's own runtime:

```bash
# Invoke a Society member against a task
agenthood run the-developer "refactor the auth middleware to use async/await"
```

Or in TypeScript, once the v2 runtime ships:

```typescript
import { BaseAgent, ReActLoop } from 'agenthood';

class SummarizerAgent extends BaseAgent {
  role = 'the-summarizer';
  skills = [new ReadFileSkill(), new WriteFileSkill()];
}

const agent = new SummarizerAgent();
const result = await agent.run('Summarize src/cli.ts into three bullet points');
```

The `run()` call enters the ReAct loop. The agent reads the file, reasons about its structure, writes the summary, and exits. Each step is logged to the console so you can watch the loop in real time.

---

## Further reading

- [ADR-004 — Specialized members over general agent](../../docs/adr/ADR-004-specialized-members-over-general-agent.md) — why 14 specialists beat one generalist
- [`src/agents/base/BaseAgent.ts`](../../src/agents/base/BaseAgent.ts) — the base agent class (v2.0.0)
- [ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629) — the foundational ReAct paper

---

## LinkedIn version

**Hook:** "AI agent" is not a marketing term. It is a specific architecture: observe, reason, act, repeat.

**Why it matters:**
- Without the observe-reason-act loop, you have a chatbot, not an agent
- Without memory, each iteration starts from zero — no learning, no context
- Agenthood's `BaseAgent` and `ReActLoop` give you the loop; you give it a role

**→** [Read the full article →](https://agenthood.flabs.tech/academy/level-2-agent-essentials/01-what-are-ai-agents/)
