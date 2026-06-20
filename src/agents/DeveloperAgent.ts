import { BaseAgent } from "./base/BaseAgent.ts"
import { WriteCodeSkill } from "../skills/code/WriteCodeSkill.ts"
import { RefactorSkill } from "../skills/code/RefactorSkill.ts"
import { ExplainCodeSkill } from "../skills/code/ExplainCodeSkill.ts"
import { SearchCodebaseSkill } from "../skills/code/SearchCodebaseSkill.ts"
import { ReadFileSkill } from "../skills/project/ReadFileSkill.ts"
import { WriteFileSkill } from "../skills/project/WriteFileSkill.ts"
import { SubagentTaskSkill } from "../skills/core/SubagentTaskSkill.ts"
import type { ISkill } from "../skills/ISkill.ts"
import type { ExecutionContext } from "../core/ExecutionContext.ts"
import type { AgentRegistry } from "../core/AgentRegistry.ts"
import type { ILLMProvider } from "../llm/ILLMProvider.ts"
import type { ReActLoop } from "../reasoning/ReActLoop.ts"
import type { SkillRegistry } from "../skills/SkillRegistry.ts"

export class DeveloperAgent extends BaseAgent {
  role = "developer";
  protected skills: ISkill[];

  constructor(
    llm: ILLMProvider,
    reasoningLoop: ReActLoop,
    skillRegistry: SkillRegistry,
    agentRegistry: AgentRegistry,
  ) {
    super(llm, reasoningLoop, skillRegistry);
    this.skills = [
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
