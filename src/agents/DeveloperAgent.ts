import { BaseAgent } from "./base/BaseAgent.ts"
import { WriteCodeSkill } from "../tools/code/WriteCodeSkill.ts"
import { RefactorSkill } from "../tools/code/RefactorSkill.ts"
import { ExplainCodeSkill } from "../tools/code/ExplainCodeSkill.ts"
import { SearchCodebaseSkill } from "../tools/code/SearchCodebaseSkill.ts"
import { ReadFileSkill } from "../tools/project/ReadFileSkill.ts"
import { WriteFileSkill } from "../tools/project/WriteFileSkill.ts"
import { SubagentTaskSkill } from "../tools/core/SubagentTaskSkill.ts"
import type { ITool } from "../tools/ITool.ts"
import type { ExecutionContext } from "../core/ExecutionContext.ts"
import type { AgentRegistry } from "../core/AgentRegistry.ts"
import type { ILLMProvider } from "../llm/ILLMProvider.ts"
import type { ReActLoop } from "../reasoning/ReActLoop.ts"
import type { ToolRegistry } from "../tools/ToolRegistry.ts"

export class DeveloperAgent extends BaseAgent {
  role = "developer";
  protected tools: ITool[];

  constructor(
    llm: ILLMProvider,
    reasoningLoop: ReActLoop,
    toolRegistry: ToolRegistry,
    agentRegistry: AgentRegistry,
  ) {
    super(llm, reasoningLoop, toolRegistry);
    this.tools = [
      new WriteCodeSkill(),
      new RefactorSkill(),
      new ReadFileSkill(),
      new WriteFileSkill(),
      new SearchCodebaseSkill(),
      new ExplainCodeSkill(),
      new SubagentTaskSkill(agentRegistry),
    ];
  }

  protected async getSystemPrompt(context: ExecutionContext): Promise<string> {
    const conventions = await context.memory.project.getConventions();
    const archDecisions =
      await context.memory.project.getArchitecturalDecisions();
    const stack = context.project.stack;

    return context.prompts.build("developer.system", {
      conventions: conventions.map((c) => `${c.name}: ${c.value}`).join("\n"),
      archDecisions: archDecisions.join("\n"),
      stack: JSON.stringify(stack),
    }).content;
  }
}
