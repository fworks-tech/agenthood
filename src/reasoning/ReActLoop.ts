import type { ILLMProvider } from '../llm/ILLMProvider.js'
import type { ExecutionContext } from '../core/ExecutionContext.js'
import type { Message, ToolCall } from '../llm/types.js'
import { SkillRegistry, SkillNotFoundError } from '../skills/SkillRegistry.js'
import { ThinkingBudget } from './ThinkingBudget.js'

export class ReActLoop {
  constructor(
    private llm: ILLMProvider,
    private skillRegistry: SkillRegistry,
    private budget: ThinkingBudget = new ThinkingBudget()
  ) {}

  async run(systemPrompt: string, userInput: string, context: ExecutionContext): Promise<string> {
    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userInput },
    ]

    for (let step = 0; ; step++) {
      this.budget.check(step)
      context.tracer.startSpan(`react-step-${step}`)

      const request = {
        messages,
        tools: this.skillRegistry.getSchemas(),
      }

      const response = await this.llm.complete(request)
      messages.push({ role: 'assistant', content: response.content, toolCalls: response.toolCalls })

      if (!response.toolCalls || response.toolCalls.length === 0) {
        context.tracer.endSpan(`react-step-${step}`, { status: 'completed' })
        return response.content
      }

      for (const toolCall of response.toolCalls) {
        const result = await this.executeTool(toolCall, context)
        messages.push({ role: 'tool', content: JSON.stringify(result), name: toolCall.name })
      }

      context.tracer.endSpan(`react-step-${step}`, { toolCount: response.toolCalls.length })
    }
  }

  private async executeTool(toolCall: ToolCall, context: ExecutionContext): Promise<string> {
    try {
      const skill = this.skillRegistry.get(toolCall.name)
      const result = await skill.execute(toolCall.args, context)
      if (!result.success) {
        return `Error: ${result.error ?? 'Unknown error'}`
      }
      return result.output
    } catch (err) {
      if (err instanceof SkillNotFoundError) {
        return `Error: Skill not found: "${toolCall.name}"`
      }
      const msg = err instanceof Error ? err.message : String(err)
      return `Error: ${msg}`
    }
  }
}
