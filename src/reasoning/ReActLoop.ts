import type { ILLMProvider } from "../llm/ILLMProvider.ts"
import type { ExecutionContext } from "../core/ExecutionContext.ts"
import type { Message, ToolCall } from "../llm/types.ts"
import { ContextCompressor } from "../core/ContextCompressor.ts"
import { SkillRegistry, SkillNotFoundError } from "../skills/SkillRegistry.ts"
import { ThinkingBudget } from "./ThinkingBudget.ts"
import { validateSchema, SchemaValidationError } from "../core/SchemaValidator.ts"

export class ToolLoopDetectedError extends Error {
  constructor(toolName: string, count: number) {
    super(`Tool loop detected: "${toolName}" called ${count} times with identical arguments within the detection window. Breaking out to avoid wasting token budget.`)
    this.name = 'ToolLoopDetectedError'
  }
}

export class ReActLoop {
  constructor(
    private llm: ILLMProvider,
    private skillRegistry: SkillRegistry,
    private budget: ThinkingBudget = new ThinkingBudget(),
    private compressor: ContextCompressor = new ContextCompressor(llm),
    private loopWindow = 5,
    private loopThreshold = 3,
  ) {}

  async run(
    systemPrompt: string,
    userInput: string,
    context: ExecutionContext,
  ): Promise<string> {
    const messages: Message[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userInput },
    ];

    const recentCalls: string[] = [];

    for (let step = 0; ; step++) {
      this.budget.check(step);
      context.tracer.startSpan(`react-step-${step}`);

      const request = {
        messages,
        tools: this.skillRegistry.getSchemas(),
      };

      const modelContextWindow = this.resolveContextWindow(request)

      request.messages = await this.compressor.compress(
        messages,
        modelContextWindow,
      )

      const response = await this.llm.complete(request);
      messages.push({
        role: "assistant",
        content: response.content,
        toolCalls: response.toolCalls,
      });

      if (!response.toolCalls || response.toolCalls.length === 0) {
        context.tracer.endSpan(`react-step-${step}`, { status: "completed" });
        return response.content;
      }

      for (const toolCall of response.toolCalls) {
        const signature = `${toolCall.name}:${JSON.stringify(toolCall.args)}`
        const occurrences = recentCalls.filter((s) => s === signature).length
        if (occurrences >= this.loopThreshold - 1) {
          context.tracer.endSpan(`react-step-${step}`, { status: "loop-detected" });
          throw new ToolLoopDetectedError(toolCall.name, occurrences + 1);
        }
        recentCalls.push(signature)
        if (recentCalls.length > this.loopWindow) recentCalls.shift()

        const result = await this.executeTool(toolCall, context);
        messages.push({
          role: "tool",
          content: JSON.stringify(result),
          tool_call_id: toolCall.id,
          name: toolCall.name,
        });
      }

      context.tracer.endSpan(`react-step-${step}`, {
        toolCount: response.toolCalls.length,
      });
    }
  }

  private async executeTool(
    toolCall: ToolCall,
    context: ExecutionContext,
  ): Promise<string> {
    try {
      const skill = this.skillRegistry.get(toolCall.name);

      // Validate tool arguments against schema before execution
      try {
        validateSchema(toolCall.args, skill.inputSchema);
      } catch (err) {
        if (err instanceof SchemaValidationError) {
          return `Error: Invalid arguments for "${toolCall.name}": ${err.message}`;
        }
        throw err;
      }

      const result = await skill.execute(toolCall.args, context);
      if (!result.success) {
        return `Error: ${result.error ?? "Unknown error"}`;
      }
      return result.output;
    } catch (err) {
      if (err instanceof SkillNotFoundError) {
        return `Error: Skill not found: "${toolCall.name}"`;
      }
      const msg = err instanceof Error ? err.message : String(err);
      return `Error: ${msg}`;
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