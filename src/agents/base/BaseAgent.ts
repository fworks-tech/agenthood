import { randomUUID } from "node:crypto";
import type { ILLMProvider } from "../../llm/ILLMProvider.ts";
import type { ITool } from "../../tools/ITool.ts";
import type { ExecutionContext } from "../../core/ExecutionContext.ts";
import type { AgentResult } from "./AgentResult.ts";
import { ReActLoop } from "../../reasoning/ReActLoop.ts";
import { ToolRegistry } from "../../tools/ToolRegistry.ts";
import type { ResidualMemory } from "../../memory/ResidualMemory.ts";
import type { EpisodeLearner } from "../../evals/EpisodeLearner.ts";
import type { EvalResult } from "../../core/types.ts";
import { reportErrorToSentry, reportBackgroundFailure } from "../../core/sentryReporter.ts";
import { recordAgentTrace, redactOrThrow, redactOrSkip } from "./agentTrace.ts";

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

    recordAgentTrace({
      role: this.role,
      model: this.reasoningLoop.model || "unknown",
      usage: this.reasoningLoop.usage,
      toolUsage: context.usage,
      input,
      output,
      durationMs,
      error,
      context,
    });
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
    // residual is a best-effort learning signal — a redaction failure must
    // not abort the run (trace recording already fails closed on it)
    const residualInput = redactOrSkip(context, input, "residual redaction failed", { member: this.role, model: this.reasoningLoop.model || this.role });
    if (residualInput === undefined) return;
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

  protected async recordRun(
    input: string,
    output: string,
    error: unknown,
    context: ExecutionContext,
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    const id = `dec-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const isSuccessful = error === null;

    // decisions and provenance persist raw payloads, so the shared redactor
    // must guard them or the redaction guarantee is only half-true
    const report = { member: this.role, model: this.reasoningLoop.model || this.role };
    const rationale = redactOrThrow(context, isSuccessful
      ? "Member run completed; see decision for output summary."
      : `Run failed: ${error instanceof Error ? error.message : String(error)}`, "run redaction failed", report, error);
    const safeInput = redactOrThrow(context, input, "run redaction failed", report, error);
    const safeOutput = redactOrThrow(context, output, "run redaction failed", report, error);

    try {
      await this.recordDecision({ id, timestamp, safeInput, safeOutput, rationale, isSuccessful, context });
      await this.trackRunProvenance({ id, timestamp, safeInput, isSuccessful, context });
    } catch (err) {
      await reportBackgroundFailure(err, context, "decision/provenance recording failed", { member: this.role, model: this.reasoningLoop.model || this.role });
    }
  }

  private async recordDecision(args: {
    id: string;
    timestamp: string;
    safeInput: string;
    safeOutput: string;
    rationale: string;
    isSuccessful: boolean;
    context: ExecutionContext;
  }): Promise<void> {
    await args.context.memory.decisions.record({
      id: args.id,
      timestamp: args.timestamp,
      member: this.role,
      task: args.safeInput,
      decision: args.safeOutput.slice(0, 2000) || "(no output)",
      rationale: args.rationale,
      alternatives: [],
      outcome: args.isSuccessful ? "completed" : "failed",
      tags: ["run"],
      confidence: args.isSuccessful ? 1 : 0,
      decisionMaker: this.role,
    });
  }

  private async trackRunProvenance(args: {
    id: string;
    timestamp: string;
    safeInput: string;
    isSuccessful: boolean;
    context: ExecutionContext;
  }): Promise<void> {
    await args.context.memory.provenance.track({
      entityId: args.context.executionId,
      entityType: "decision",
      activityId: `run:${this.role}`,
      agentId: this.role,
      agentType: "software_agent",
      role: "generator",
      sourceDocument: args.safeInput.slice(0, 500),
      timestamp: args.timestamp,
      confidence: args.isSuccessful ? 1 : 0,
      metadata: { decisionId: args.id, success: args.isSuccessful },
    });
  }
}
