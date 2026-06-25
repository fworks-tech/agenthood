import type { ILLMProvider } from "../../llm/ILLMProvider.js";
import type { ISkill } from "../../skills/ISkill.js";
import type { ExecutionContext } from "../../core/ExecutionContext.js";
import type { AgentResult } from "./AgentResult.js";
import { ReActLoop } from "../../reasoning/ReActLoop.js";
import { SkillRegistry } from "../../skills/SkillRegistry.js";
import type { ResidualMemory } from "../../memory/ResidualMemory.js";

export abstract class BaseAgent {
  abstract role: string;
  protected abstract skills: ISkill[];
  protected abstract getSystemPrompt(
    context: ExecutionContext,
  ): Promise<string>;

  constructor(
    readonly llm: ILLMProvider,
    protected reasoningLoop: ReActLoop,
    protected skillRegistry: SkillRegistry,
    protected residualMemory?: ResidualMemory,
  ) {}

  async run(input: string, context: ExecutionContext): Promise<AgentResult> {
    for (const skill of this.skills) {
      if (!this.skillRegistry.has(skill.name)) {
        this.skillRegistry.register(skill);
      }
    }

    this.residualMemory?.decay();

    const systemPrompt = await this.getSystemPrompt(context);
    context.tracer.startSpan(this.role);

    const output = await this.reasoningLoop.run(systemPrompt, input, context);
    context.tracer.endSpan(this.role, { output });

    this.residualMemory?.record(`agent:${this.role}:${input.slice(0, 80)}`, 0.5);

    return { role: this.role, output, artifacts: context.artifacts };
  }
}
