import type { ILLMProvider } from "../llm/ILLMProvider.ts"
import type { ExecutionContext } from "../core/ExecutionContext.ts"
import type { Message, TokenUsage, ToolCall, LLMResponse } from "../llm/types.ts"
import { ContextCompressor } from "../core/ContextCompressor.ts"
import { CostEstimator } from "../core/CostEstimator.ts"
import { ToolRegistry, ToolNotFoundError } from "../tools/ToolRegistry.ts"
import { AskHumanSignal } from "../tools/human/AskHumanSignal.ts"
import type { ITool } from "../tools/ITool.ts"
import { ThinkingBudget } from "./ThinkingBudget.ts"
import { validateSchema, SchemaValidationError } from "../core/SchemaValidator.ts"
import { redactEventText } from "../core/RunEventBus.ts"
import { SKILL_ACTIVATION_PREFIX } from "../skills/activation/ActivateSkillTool.ts"

const costEstimator = new CostEstimator()

export class ToolLoopDetectedError extends Error {
  constructor(toolName: string, count: number) {
    super(`Tool loop detected: "${toolName}" called ${count} times with identical arguments within the detection window. Breaking out to avoid wasting token budget.`)
    this.name = 'ToolLoopDetectedError'
  }
}

export class MaxStepsExceededError extends Error {
  readonly partialResult: string

  constructor(partialResult: string, maxSteps: number) {
    super(`Max steps (${maxSteps}) exceeded`)
    this.name = 'MaxStepsExceededError'
    this.partialResult = partialResult
  }
}

export interface ReActLoopOptions {
  budget?: ThinkingBudget
  compressor?: ContextCompressor
  loopWindow?: number
  loopThreshold?: number
  maxSteps?: number
}

export class ReActLoop {
  activatedSkills = new Set<string>()
  usage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
  private _model = ""

  /** Responding model of the most recent step; the loop owns the write. */
  get model(): string {
    return this._model
  }

  setModel(model: string): void {
    this._model = model
  }

  private _member = ""

  /** Member identity of the current run, stamped by the owning agent. */
  get member(): string {
    return this._member
  }

  setMember(member: string): void {
    this._member = member
  }

  private readonly budget: ThinkingBudget
  private readonly compressor: ContextCompressor
  private readonly loopWindow: number
  private readonly loopThreshold: number
  private readonly maxSteps: number

  constructor(
    private llm: ILLMProvider,
    private skillRegistry: ToolRegistry,
    options: ReActLoopOptions = {},
  ) {
    this.budget = options.budget ?? new ThinkingBudget()
    this.compressor = options.compressor ?? new ContextCompressor(llm)
    this.loopWindow = options.loopWindow ?? 5
    this.loopThreshold = options.loopThreshold ?? 3
    this.maxSteps = options.maxSteps ?? 100
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
    this._model = "";

    const recentCalls: string[] = [];

    for (let step = 0; ; step++) {
      if (step >= this.maxSteps) {
        const lastContent = messages[messages.length - 1]?.content ?? ''
        const partialResult = `Max steps (${this.maxSteps}) exceeded. Partial result:\n${lastContent}`
        throw new MaxStepsExceededError(partialResult, this.maxSteps)
      }
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
    this._model = response.model || this._model;
    const promptTokens = response.usage?.promptTokens ?? 0;
    const completionTokens = response.usage?.completionTokens ?? 0;
    this.usage.promptTokens += promptTokens;
    this.usage.completionTokens += completionTokens;
    this.usage.totalTokens += response.usage?.totalTokens ?? 0;
    messages.push({
      role: "assistant",
      content: response.content,
      toolCalls: response.toolCalls,
    });

    this.emitReasoningEvent(context, step, response, promptTokens, completionTokens, modelContextWindow);

    return response
  }

  private emitReasoningEvent(
    context: ExecutionContext,
    step: number,
    response: LLMResponse,
    promptTokens: number,
    completionTokens: number,
    contextWindow: number,
  ): void {
    const stepCost = costEstimator.computeCost(this._model, promptTokens, completionTokens).estimatedCost
    const reasoning = redactEventText(context, response.content)
    console.info(`[step ${step}] ${this._model} · ${promptTokens}+${completionTokens} tok · $${stepCost} · ${reasoning}`)

    context.events.emit({
      type: "reasoning",
      executionId: context.executionId,
      member: this._member,
      correlationId: context.correlationId,
      timestamp: new Date().toISOString(),
      step,
      content: reasoning,
      model: response.model,
      promptTokens,
      completionTokens,
      stepCost,
      contextWindow,
      contextUtil: contextWindow > 0 ? Math.min(promptTokens / contextWindow, 1) : undefined,
    });
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

      context.events.emit({
        type: "tool.called",
        executionId: context.executionId,
        member: this._member,
        correlationId: context.correlationId,
        timestamp: new Date().toISOString(),
        step,
        name: toolCall.name,
        args: redactEventText(context, JSON.stringify(toolCall.args ?? {})),
      });

      const toolStart = performance.now()
      const result = await this.executeTool(toolCall, context);
      const durationMs = Math.round(performance.now() - toolStart)
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

      context.events.emit({
        type: "tool.result",
        executionId: context.executionId,
        member: this._member,
        correlationId: context.correlationId,
        timestamp: new Date().toISOString(),
        step,
        name: toolCall.name,
        output: redactEventText(context, content),
        durationMs,
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
      // a parked run has no tool result to observe — the host persists the
      // question and releases the slot, so the signal must escape the loop
      if (err instanceof AskHumanSignal) throw err
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