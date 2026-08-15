import type { ILLMProvider } from "../llm/ILLMProvider.ts"
import type { ExecutionContext } from "../core/ExecutionContext.ts"
import type { Message, TokenUsage, ToolCall, LLMResponse } from "../llm/types.ts"
import { ContextCompressor } from "../core/ContextCompressor.ts"
import { ToolRegistry, ToolNotFoundError } from "../tools/ToolRegistry.ts"
import type { ITool } from "../tools/ITool.ts"
import { ThinkingBudget } from "./ThinkingBudget.ts"
import { validateSchema, SchemaValidationError } from "../core/SchemaValidator.ts"
import { SKILL_ACTIVATION_PREFIX } from "../skills/activation/ActivateSkillTool.ts"

export class ToolLoopDetectedError extends Error {
  constructor(toolName: string, count: number) {
    super(`Tool loop detected: "${toolName}" called ${count} times with identical arguments within the detection window. Breaking out to avoid wasting token budget.`)
    this.name = 'ToolLoopDetectedError'
  }
}

export interface ReActLoopOptions {
  budget?: ThinkingBudget
  compressor?: ContextCompressor
  loopWindow?: number
  loopThreshold?: number
}

export class ReActLoop {
  activatedSkills = new Set<string>()
  usage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
  model = ""

  setModel(model: string): void {
    this.model = model
  }

  private readonly budget: ThinkingBudget
  private readonly compressor: ContextCompressor
  private readonly loopWindow: number
  private readonly loopThreshold: number

  constructor(
    private llm: ILLMProvider,
    private skillRegistry: ToolRegistry,
    options: ReActLoopOptions = {},
  ) {
    this.budget = options.budget ?? new ThinkingBudget()
    this.compressor = options.compressor ?? new ContextCompressor(llm)
    this.loopWindow = options.loopWindow ?? 5
    this.loopThreshold = options.loopThreshold ?? 3
  }

  async run(
    systemPrompt: string,
    userInput: string,
    context: ExecutionContext,
  ): Promise<string> {
    const messages: Message[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userInput },
    ];

    this.usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    this.model = "";

    const recentCalls: string[] = [];

    for (let step = 0; ; step++) {
      const response = await this.runStep(step, messages, context);

      if (!response.toolCalls || response.toolCalls.length === 0) {
        context.tracer.endSpan(`react-step-${step}`, { status: "completed" });
        return response.content;
      }

      await this.runToolCalls(response.toolCalls, messages, recentCalls, step, context);

      context.tracer.endSpan(`react-step-${step}`, {
        toolCount: response.toolCalls.length,
      });
    }
  }

  private async runStep(
    step: number,
    messages: Message[],
    context: ExecutionContext,
  ): Promise<LLMResponse> {
    this.budget.check(step);
    context.tracer.startSpan(`react-step-${step}`);

    const request = {
      messages,
      tools: this.skillRegistry.getSchemas(),
    }

    const modelContextWindow = this.resolveContextWindow(request)

    request.messages = await this.compressor.compress(
      messages,
      modelContextWindow,
      this.activatedSkills.size > 0,
    )

    const response = await this.llm.complete(request);
    this.model = response.model || this.model;
    this.usage.promptTokens += response.usage?.promptTokens ?? 0;
    this.usage.completionTokens += response.usage?.completionTokens ?? 0;
    this.usage.totalTokens += response.usage?.totalTokens ?? 0;
    messages.push({
      role: "assistant",
      content: response.content,
      toolCalls: response.toolCalls,
    });

    return response
  }

  private async runToolCalls(
    toolCalls: ToolCall[],
    messages: Message[],
    recentCalls: string[],
    step: number,
    context: ExecutionContext,
  ): Promise<void> {
    for (const toolCall of toolCalls) {
      const signature = `${toolCall.name}:${JSON.stringify(toolCall.args)}`
      const occurrences = recentCalls.filter((s) => s === signature).length
      if (occurrences >= this.loopThreshold - 1) {
        context.tracer.endSpan(`react-step-${step}`, { status: "loop-detected" });
        throw new ToolLoopDetectedError(toolCall.name, occurrences + 1);
      }
      recentCalls.push(signature)
      if (recentCalls.length > this.loopWindow) recentCalls.shift()

      const result = await this.executeTool(toolCall, context);
      const content = typeof result === 'string' ? result : JSON.stringify(result)
      if (content.startsWith(SKILL_ACTIVATION_PREFIX)) {
        const nameMatch = content.match(/<skill_content name="([^"]+)">/)
        if (nameMatch) this.activatedSkills.add(nameMatch[1])
      }
      messages.push({
        role: "tool",
        content,
        tool_call_id: toolCall.id,
        name: toolCall.name,
      });
    }
  }

  private async executeTool(
    toolCall: ToolCall,
    context: ExecutionContext,
  ): Promise<string> {
    let skill: ITool
    try {
      skill = this.skillRegistry.get(toolCall.name)
    } catch (err) {
      if (err instanceof ToolNotFoundError) return `Error: Tool not found: "${toolCall.name}"`
      const msg = err instanceof Error ? err.message : String(err)
      return `Error: ${msg}`
    }

    const validationError = this.validateToolArgs(toolCall, skill)
    if (validationError) return validationError

    try {
      const result = await skill.execute(toolCall.args, context)
      if (!result.success) return `Error: ${result.error ?? "Unknown error"}`
      return result.output
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return `Error: ${msg}`
    }
  }

  private validateToolArgs(toolCall: ToolCall, skill: ITool): string | null {
    try {
      validateSchema(toolCall.args, skill.inputSchema)
      return null
    } catch (err) {
      if (err instanceof SchemaValidationError) {
        return `Error: Invalid arguments for "${toolCall.name}": ${err.message}`
      }
      throw err
    }
  }

  private resolveContextWindow(request: { contextWindow?: number } & Record<string, unknown>): number {
    return (
      request.contextWindow ??
      this.llm.getContextWindow() ??
      8192
    )
  }
}