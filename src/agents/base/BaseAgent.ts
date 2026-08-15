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

export abstract class BaseAgent {
  abstract role: string;
  protected abstract tools: ITool[];
  protected abstract getSystemPrompt(
    context: ExecutionContext,
  ): Promise<string>;

  constructor(
    readonly llm: ILLMProvider,
    protected reasoningLoop: ReActLoop,
    protected toolRegistry: ToolRegistry,
    protected residualMemory?: ResidualMemory,
    protected episodeLearner?: EpisodeLearner,
  ) {}

  private readonly costEstimator = new CostEstimator();

  async run(input: string, context: ExecutionContext): Promise<AgentResult> {
    return this.runWithExecutor(input, context, (systemPrompt, task) =>
      this.reasoningLoop.run(systemPrompt, task, context),
    )
  }

  /**
   * Shared invocation lifecycle: tool registration, decay, prompt, timing,
   * tracing, learning, decision/provenance recording, and Sentry reporting.
   * Subclasses that execute differently (e.g. Oracle's retrieval-first ask)
   * supply the executor and inherit the whole lifecycle.
   */
  protected async runWithExecutor(
    input: string,
    context: ExecutionContext,
    execute: (systemPrompt: string, input: string) => Promise<string>,
  ): Promise<AgentResult> {
    for (const tool of this.tools) {
      if (!this.toolRegistry.has(tool.name)) {
        this.toolRegistry.register(tool);
      }
    }

    this.residualMemory?.decay();

    const systemPrompt = await this.getSystemPrompt(context);
    context.tracer.startSpan(this.role);

    const startTime = performance.now();
    let output = "";
    let error: unknown = null;
    try {
      output = await execute(systemPrompt, input);
    } catch (err) {
      error = err;
    }
    const durationMs = Math.round(performance.now() - startTime);
    context.tracer.endSpan(this.role, { output });

    this.recordTrace(input, output, durationMs, error, context);

    const residualInput = redact(context, input);
    this.residualMemory?.record(`agent:${this.role}:${residualInput.slice(0, 80)}`, 0.5);

    const result: AgentResult = { role: this.role, output, artifacts: context.artifacts };

    const evalResult: EvalResult = {
      episodeId: context.executionId,
      scores: {},
      metadata: { member: this.role },
    };

    this.episodeLearner?.learn(evalResult, context).catch((err) => {
      void reportBackgroundFailure(err, context, "episode learner failed", { member: this.role, model: this.reasoningLoop.model || this.role });
    });

    await this.recordRun(input, output, error, context);

    if (error) {
      await this.reportFailure(error, durationMs, context);
    }
    return result;
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
    const usage = this.reasoningLoop.usage;
    const model = this.reasoningLoop.model || "unknown";
    // redact before hashing so inputHash/outputHash always match the
    // persisted (redacted) payload; Tracer.record's own pass is a no-op then
    const safeInput = redact(context, input);
    const safeOutput = redact(context, output);
    // tool-level LLM calls (WriteCode/Refactor/Explain) accumulate here
    const toolUsage = context.usage;
    const promptTokens = (usage?.promptTokens ?? 0) + (toolUsage?.promptTokens ?? 0);
    const completionTokens = (usage?.completionTokens ?? 0) + (toolUsage?.completionTokens ?? 0);
    const totalTokens = (usage?.totalTokens ?? 0) + (toolUsage?.totalTokens ?? 0);
    try {
      context.tracer.record(
        createTraceEnvelope({
          member: this.role,
          input: safeInput,
          output: safeOutput,
          durationMs,
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
          qualityScore: getMemberQualityScore(this.role, join(context.project.localPath, '.agenthood', 'baselines')),
          status: error ? "error" : "success",
          correlationId: context.correlationId ?? context.executionId,
          source: context.source,
          model,
        }),
      );
    } catch (err) {
      void reportBackgroundFailure(err, context, "trace recording failed", { member: this.role, model: this.reasoningLoop.model || this.role });
    }
  }

  protected async recordRun(
    input: string,
    output: string,
    error: unknown,
    context: ExecutionContext,
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    const id = `dec-${Date.now()}-${randomUUID().slice(0, 4)}`;
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
