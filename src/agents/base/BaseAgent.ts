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
import { reportErrorToSentry } from "../../core/sentryReporter.js";

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
  ) {
    this.costEstimator = new CostEstimator();
  }

  private readonly costEstimator: CostEstimator;

  async run(input: string, context: ExecutionContext): Promise<AgentResult> {
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
      output = await this.reasoningLoop.run(systemPrompt, input, context);
    } catch (err) {
      error = err;
    }
    const durationMs = Math.round(performance.now() - startTime);
    context.tracer.endSpan(this.role, { output });

    this.recordTrace(input, output, durationMs, error, context);

    this.residualMemory?.record(`agent:${this.role}:${input.slice(0, 80)}`, 0.5);

    const result: AgentResult = { role: this.role, output, artifacts: context.artifacts };

    const evalResult: EvalResult = {
      episodeId: context.executionId,
      scores: {},
      metadata: { member: this.role },
    };

    this.episodeLearner?.learn(evalResult, context).catch((err) => {
      console.error(`[BaseAgent] episode learner failed: ${err instanceof Error ? err.message : String(err)}`)
    });

    await this.recordRun(input, output, error, context);

    if (error) {
      await reportErrorToSentry(error, context, {
        member: this.role,
        model: this.reasoningLoop.model || "unknown",
        durationMs,
        status: "error",
        correlationId: context.correlationId ?? context.executionId,
      });
      throw error;
    }
    return result;
  }

  private recordTrace(
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
    const safeInput = context.redactor ? context.redactor.redactText(input) : input;
    const safeOutput = context.redactor ? context.redactor.redactText(output) : output;
    try {
      context.tracer.record(
        createTraceEnvelope({
          member: this.role,
          input: safeInput,
          output: safeOutput,
          durationMs,
          tokenCount: {
            input: usage?.promptTokens ?? 0,
            output: usage?.completionTokens ?? 0,
            total: usage?.totalTokens ?? 0,
          },
          cost: this.costEstimator.computeCost(
            model,
            usage?.promptTokens ?? 0,
            usage?.completionTokens ?? 0,
          ).estimatedCost,
          qualityScore: getMemberQualityScore(this.role, join(context.project.localPath, '.agenthood', 'baselines')),
          status: error ? "error" : "success",
          correlationId: context.correlationId ?? context.executionId,
          source: context.source,
          model,
        }),
      );
    } catch (err) {
      console.error(`[BaseAgent] trace recording failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  private async recordRun(
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
    const redactor = context.redactor;
    const safeInput = redactor ? redactor.redactText(input) : input;
    const safeOutput = redactor ? redactor.redactText(output) : output;

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
      console.error(`[BaseAgent] decision/provenance recording failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
}
