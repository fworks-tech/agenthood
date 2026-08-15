import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type { ILLMProvider } from "../../llm/ILLMProvider.js";
import type { ITool } from "../../tools/ITool.js";
import type { ExecutionContext } from "../../core/ExecutionContext.js";
import type { AgentResult } from "./AgentResult.js";
import { ReActLoop } from "../../reasoning/ReActLoop.js";
import { ToolRegistry } from "../../tools/ToolRegistry.js";
import type { ResidualMemory } from "../../memory/ResidualMemory.js";
import type { EpisodeLearner } from "../../evals/EpisodeLearner.js";
import type { EvalResult } from "../../core/types.js";
import { createTraceEnvelope } from "../../core/TraceEnvelope.js";
import { CostEstimator } from "../../core/CostEstimator.js";
import { getMemberQualityScore } from "../../core/qualityScore.js";
import { reportErrorToSentry, reportBackgroundFailure } from "../../core/sentryReporter.js";

function redact(context: ExecutionContext, text: string): string {
  // production contexts always carry a redactor built from the observability
  // config (ApplicationContext, eval.ts); the fallback keeps test and
  // embedding-free callers working without silently persisting raw payloads
  return context.redactor ? context.redactor.redactText(text) : text;
}

export interface BaseAgentOptions {
  residualMemory?: ResidualMemory;
  episodeLearner?: EpisodeLearner;
}

export abstract class BaseAgent {
  abstract role: string;
  protected abstract tools: ITool[];
  protected abstract getSystemPrompt(
    context: ExecutionContext,
  ): Promise<string>;

  protected residualMemory?: ResidualMemory;
  protected episodeLearner?: EpisodeLearner;

  constructor(
    readonly llm: ILLMProvider,
    protected reasoningLoop: ReActLoop,
    protected toolRegistry: ToolRegistry,
    options: BaseAgentOptions = {},
  ) {
    this.residualMemory = options.residualMemory;
    this.episodeLearner = options.episodeLearner;
  }

  private readonly costEstimator = new CostEstimator();

  async run(input: string, context: ExecutionContext): Promise<AgentResult> {
    return this.runWithExecutor(input, context, async (systemPrompt, task) => {
      const output = await this.reasoningLoop.run(systemPrompt, task, context);
      return { output, model: this.reasoningLoop.model || undefined };
    })
  }

  /**
   * Shared invocation lifecycle: tool registration, decay, prompt, timing,
   * tracing, learning, decision/provenance recording, and Sentry reporting.
   * Subclasses that execute differently (e.g. Oracle's retrieval-first ask)
   * supply the executor and inherit the whole lifecycle. Executors return the
   * responding model so attribution is recorded centrally, not by poking the
   * loop from the agent layer.
   */
  protected async runWithExecutor(
    input: string,
    context: ExecutionContext,
    execute: (systemPrompt: string, input: string) => Promise<{ output: string; model?: string }>,
  ): Promise<AgentResult> {
    this.registerTools();

    this.residualMemory?.decay();

    const systemPrompt = await this.getSystemPrompt(context);
    context.tracer.startSpan(this.role);

    const { output, error, durationMs } = await this.runExecutorStage(execute, systemPrompt, input);
    context.tracer.endSpan(this.role, { output });

    this.recordTrace(input, output, durationMs, error, context);
    this.recordResidual(input, context);

    const result: AgentResult = { role: this.role, output, artifacts: context.artifacts };
    this.learnFromRun(context);

    await this.recordRun(input, output, error, context);

    if (error) {
      await this.reportFailure(error, durationMs, context);
    }
    return result;
  }

  private async runExecutorStage(
    execute: (systemPrompt: string, input: string) => Promise<{ output: string; model?: string }>,
    systemPrompt: string,
    input: string,
  ): Promise<{ output: string; error: unknown; durationMs: number }> {
    const startTime = performance.now();
    let error: unknown = null;
    let output = "";
    try {
      const executed = await execute(systemPrompt, input);
      output = executed.output;
      if (executed.model) this.reasoningLoop.setModel(executed.model);
    } catch (err) {
      error = err;
    }
    return { output, error, durationMs: Math.round(performance.now() - startTime) };
  }

  private registerTools(): void {
    for (const tool of this.tools) {
      if (!this.toolRegistry.has(tool.name)) {
        this.toolRegistry.register(tool);
      }
    }
  }

  private recordResidual(input: string, context: ExecutionContext): void {
    const residualInput = redact(context, input);
    this.residualMemory?.record(`agent:${this.role}:${residualInput.slice(0, 80)}`, 0.5);
  }

  private learnFromRun(context: ExecutionContext): void {
    const evalResult: EvalResult = {
      episodeId: context.executionId,
      scores: {},
      metadata: { member: this.role },
    };
    this.episodeLearner?.learn(evalResult, context).catch((err) => {
      void reportBackgroundFailure(err, context, "episode learner failed", { member: this.role, model: this.reasoningLoop.model || this.role });
    });
  }

  private async reportFailure(
    error: unknown,
    durationMs: number,
    context: ExecutionContext,
  ): Promise<never> {
    await reportErrorToSentry(error, context, {
      member: this.role,
      model: this.reasoningLoop.model || this.role,
      durationMs,
      status: "error",
      correlationId: context.correlationId ?? context.executionId,
    });
    throw error;
  }

  protected recordTrace(
    input: string,
    output: string,
    durationMs: number,
    error: unknown,
    context: ExecutionContext,
  ): void {
    // redact before hashing so inputHash/outputHash always match the
    // persisted (redacted) payload; Tracer.record's own pass is a no-op then
    const safeInput = redact(context, input);
    const safeOutput = redact(context, output);
    try {
      context.tracer.record(
        this.buildTraceEnvelope({ input: safeInput, output: safeOutput, durationMs, error, context }),
      );
    } catch (err) {
      void reportBackgroundFailure(err, context, "trace recording failed", { member: this.role, model: this.reasoningLoop.model || this.role });
    }
  }

  private buildTraceEnvelope(args: {
    input: string;
    output: string;
    durationMs: number;
    error: unknown;
    context: ExecutionContext;
  }): ReturnType<typeof createTraceEnvelope> {
    const usage = this.reasoningLoop.usage;
    const model = this.reasoningLoop.model || "unknown";
    // tool-level LLM calls (WriteCode/Refactor/Explain) accumulate here
    const toolUsage = args.context.usage;
    const promptTokens = (usage?.promptTokens ?? 0) + (toolUsage?.promptTokens ?? 0);
    const completionTokens = (usage?.completionTokens ?? 0) + (toolUsage?.completionTokens ?? 0);
    const totalTokens = (usage?.totalTokens ?? 0) + (toolUsage?.totalTokens ?? 0);
    return createTraceEnvelope({
      member: this.role,
      input: args.input,
      output: args.output,
      durationMs: args.durationMs,
      tokenCount: {
        input: promptTokens,
        output: completionTokens,
        total: totalTokens,
      },
      cost: this.costEstimator.computeCost(
        model,
        promptTokens,
        completionTokens,
      ).estimatedCost,
      qualityScore: getMemberQualityScore(this.role, join(args.context.project.localPath, '.agenthood', 'baselines')),
      status: args.error ? "error" : "success",
      correlationId: args.context.correlationId ?? args.context.executionId,
      source: args.context.source,
      model,
    });
  }

  protected async recordRun(
    input: string,
    output: string,
    error: unknown,
    context: ExecutionContext,
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    const id = `dec-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const succeeded = error === null;
    const rationale = succeeded
      ? "Member run completed; see decision for output summary."
      : `Run failed: ${error instanceof Error ? error.message : String(error)}`;

    // decisions and provenance persist raw payloads, so the shared redactor
    // must guard them or the redaction guarantee is only half-true
    const safeInput = redact(context, input);
    const safeOutput = redact(context, output);

    try {
      await context.memory.decisions.record({
        id,
        timestamp,
        member: this.role,
        task: safeInput,
        decision: safeOutput.slice(0, 2000) || "(no output)",
        rationale,
        alternatives: [],
        outcome: succeeded ? "completed" : "failed",
        tags: ["run"],
        confidence: succeeded ? 1 : 0,
        decisionMaker: this.role,
      });
      await context.memory.provenance.track({
        entityId: context.executionId,
        entityType: "decision",
        activityId: `run:${this.role}`,
        agentId: this.role,
        agentType: "software_agent",
        role: "generator",
        sourceDocument: safeInput.slice(0, 500),
        timestamp,
        confidence: succeeded ? 1 : 0,
        metadata: { decisionId: id, success: succeeded },
      });
    } catch (err) {
      await reportBackgroundFailure(err, context, "decision/provenance recording failed", { member: this.role, model: this.reasoningLoop.model || this.role });
    }
  }
}
