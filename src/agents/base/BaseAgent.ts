import { randomUUID } from "node:crypto";
import type { ILLMProvider } from "../../llm/ILLMProvider.js";
import type { ITool } from "../../tools/ITool.js";
import type { ExecutionContext } from "../../core/ExecutionContext.js";
import type { AgentResult } from "./AgentResult.js";
import { ReActLoop } from "../../reasoning/ReActLoop.js";
import { ToolRegistry } from "../../tools/ToolRegistry.js";
import type { ResidualMemory } from "../../memory/ResidualMemory.js";
import type { EpisodeLearner } from "../../evals/EpisodeLearner.js";
import type { EvalResult } from "../../core/types.js";

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

  async run(input: string, context: ExecutionContext): Promise<AgentResult> {
    for (const tool of this.tools) {
      if (!this.toolRegistry.has(tool.name)) {
        this.toolRegistry.register(tool);
      }
    }

    this.residualMemory?.decay();

    const systemPrompt = await this.getSystemPrompt(context);
    context.tracer.startSpan(this.role);

    let output = "";
    let error: unknown = null;
    try {
      output = await this.reasoningLoop.run(systemPrompt, input, context);
    } catch (err) {
      error = err;
    }
    context.tracer.endSpan(this.role, { output });

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

    if (error) throw error;
    return result;
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

    try {
      await context.memory.decisions.record({
        id,
        timestamp,
        member: this.role,
        task: input,
        decision: output.slice(0, 2000) || "(no output)",
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
        sourceDocument: input.slice(0, 500),
        timestamp,
        confidence: succeeded ? 1 : 0,
        metadata: { decisionId: id, success: succeeded },
      });
    } catch (err) {
      console.error(`[BaseAgent] decision/provenance recording failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
}
