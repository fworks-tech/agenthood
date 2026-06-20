import { randomUUID } from "node:crypto";
import { PromptBuilder } from "../prompts/PromptBuilder.ts"
import { PromptRegistry } from "../prompts/PromptRegistry.ts"
import { LLMRouter } from "../llm/LLMRouter.ts"
import { SkillRegistry } from "../skills/SkillRegistry.ts"
import { ReActLoop } from "../reasoning/ReActLoop.ts"
import { AgentRegistry } from "../core/AgentRegistry.ts"
import { DeveloperAgent } from "../agents/DeveloperAgent.ts"
import type { ExecutionContext } from "../core/ExecutionContext.ts"

const agentRegistry = new AgentRegistry();

function createContext(projectPath: string): ExecutionContext {
  const llm = LLMRouter.create({});
  const sReg = new SkillRegistry();
  const loop = new ReActLoop(llm, sReg);
  const dev = new DeveloperAgent(llm, loop, sReg, agentRegistry);
  agentRegistry.register(dev);

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

export async function run(args: string[]): Promise<void> {
  const [agentName, ...taskParts] = args;
  if (!agentName || taskParts.length === 0) {
    console.error('Usage: agenthood run <agent> "<task description>"');
    process.exit(1);
  }

  const context = createContext(process.cwd());
  const agent = agentRegistry.get(agentName);

  try {
    const result = await agent.run(taskParts.join(" "), context);
    console.log(`\n\u2714 ${result.role} result:\n${result.output}\n`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error running agent "${agentName}": ${msg}`);
    process.exit(1);
  }
}
