import { randomUUID } from "node:crypto";
import { PromptBuilder } from "../prompts/PromptBuilder.ts"
import { PromptRegistry } from "../prompts/PromptRegistry.ts"
import { LLMRouter } from "../llm/LLMRouter.ts"
import { SkillRegistry } from "../skills/SkillRegistry.ts"
import { ReActLoop } from "../reasoning/ReActLoop.ts"
import { AgentRegistry } from "../core/AgentRegistry.ts"
import { DeveloperAgent } from "../agents/DeveloperAgent.ts"
import { ArchitectAgent } from "../agents/ArchitectAgent.ts"
import { ReviewerAgent } from "../agents/ReviewerAgent.ts"
import { QAAgent } from "../agents/QAAgent.ts"
import { MemberRegistry, MemberAgent } from "../members/index.ts"
import type { ExecutionContext } from "../core/ExecutionContext.ts"

const agentRegistry = new AgentRegistry();
const memberRegistry = new MemberRegistry();

function createContext(projectPath: string): ExecutionContext {
  const llm = LLMRouter.create({});
  const sReg = new SkillRegistry();
  const loop = new ReActLoop(llm, sReg);

  // Register template agents for backward compat and direct invocation
  const dev = new DeveloperAgent(llm, loop, sReg, agentRegistry);
  agentRegistry.register(dev);
  agentRegistry.register(new ArchitectAgent(llm, loop, sReg));
  agentRegistry.register(new ReviewerAgent(llm, loop, sReg));
  agentRegistry.register(new QAAgent(llm, loop, sReg));

  return {
    executionId: randomUUID(),
    project: {
      localPath: projectPath,
      name: projectPath.split(/[/\\]/).pop() ?? "project",
    },
    memory: {
      shortTerm: { add: () => {}, getRecent: () => [], clear: () => {} },
      longTerm: { store: async () => {}, retrieve: async () => null },
      episodic: { record: async () => {}, recall: async () => [] },
      project: {
        getConventions: async () => [],
        getArchitecturalDecisions: async () => [],
      },
    },
    llm,
    prompts: new PromptBuilder(new PromptRegistry()),
    tracer: { startSpan: () => {}, endSpan: () => {} },
    artifacts: [],
  };
}

function validateApiKeys(): void {
  const missing: string[] = [];
  if (!process.env.GROQ_API_KEY) missing.push('GROQ_API_KEY');
  if (!process.env.OPENAI_API_KEY) missing.push('OPENAI_API_KEY');
  if (!process.env.ANTHROPIC_API_KEY) missing.push('ANTHROPIC_API_KEY');

  if (missing.length === 3) {
    console.error('');
    console.error('No LLM provider API keys found. Set at least one:');
    console.error('  $env:GROQ_API_KEY = "your-key"        (free tier available)');
    console.error('  $env:OPENAI_API_KEY = "your-key"');
    console.error('  $env:ANTHROPIC_API_KEY = "your-key"');
    console.error('');
    console.error('Or run Ollama locally for offline execution (no key needed).');
    console.error('');
    process.exit(1);
  }
}

export async function run(args: string[]): Promise<void> {
  const [agentName, ...taskParts] = args;
  if (!agentName || taskParts.length === 0) {
    console.error('Usage: agenthood run <agent> "<task description>"');
    process.exit(1);
  }

  validateApiKeys();

  const context = createContext(process.cwd());
  const task = taskParts.join(" ");

  // Try Society member first (14 named members)
  if (memberRegistry.has(agentName)) {
    const spec = memberRegistry.get(agentName);
    // Use per-member preferred provider with failover fallback
    const llm = LLMRouter.createForMember(spec.preferredProvider, {});
    const sReg = new SkillRegistry();
    const loop = new ReActLoop(llm, sReg);
    const agent = new MemberAgent(spec, llm, loop, sReg);

    try {
      const result = await agent.run(task, context);
      console.log(`\n\u2714 ${result.role} result:\n${result.output}\n`);
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Error running member "${agentName}": ${msg}`);
      process.exit(1);
    }
  }

  // Fall back to generic template agents (developer, architect, reviewer, qa)
  try {
    const agent = agentRegistry.get(agentName);
    const result = await agent.run(task, context);
    console.log(`\n\u2714 ${result.role} result:\n${result.output}\n`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error running agent "${agentName}": ${msg}`);
    process.exit(1);
  }
}
