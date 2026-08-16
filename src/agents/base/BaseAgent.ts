import type { ILLMProvider } from '../../llm/ILLMProvider.ts';
import type { ITool } from '../../tools/ITool.ts';
import type { ExecutionContext } from '../../core/ExecutionContext.ts';
import type { AgentResult } from './AgentResult.ts';
import type { ReActLoop } from '../../reasoning/ReActLoop.ts';
import { MaxStepsExceededError } from '../../reasoning/ReActLoop.ts';
import { RunLifecycle } from './runLifecycle.ts';
import { ToolRegistry } from '../../tools/ToolRegistry.ts';
import type { ResidualMemory } from '../../memory/ResidualMemory.ts';
import type { EpisodeLearner } from '../../evals/EpisodeLearner.ts';

export interface BaseAgentOptions {
  residualMemory?: ResidualMemory;
  episodeLearner?: EpisodeLearner;
}

/**
 * Base lifecycle for every agent. Intentional dependency hub: by contract it
 * touches the LLM, tool, core, reasoning, memory, and evals layers — changing
 * any of those surfaces is expected to flow through here.
 */
export abstract class BaseAgent {
  abstract role: string;
  protected abstract tools: ITool[];
  protected abstract getSystemPrompt(
    context: ExecutionContext,
  ): Promise<string>;

  protected residualMemory?: ResidualMemory;
  protected episodeLearner?: EpisodeLearner;
  private readonly lifecycle: RunLifecycle;

  constructor(
    readonly llm: ILLMProvider,
    protected reasoningLoop: ReActLoop,
    protected toolRegistry: ToolRegistry,
    options: BaseAgentOptions = {},
  ) {
    this.residualMemory = options.residualMemory;
    this.episodeLearner = options.episodeLearner;
    // getRole is lazy: subclass role fields are not initialized until after
    // this constructor returns
    this.lifecycle = new RunLifecycle(() => this.role, this.reasoningLoop, this.residualMemory, this.episodeLearner);
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

    this.lifecycle.recordTrace({ input, output, durationMs, error, context });
    this.lifecycle.recordResidual(input, context);
    const result: AgentResult = { role: this.role, output, artifacts: context.artifacts };
    this.lifecycle.learnFromRun(context);

    await this.lifecycle.recordRun(input, output, error, context);

    if (error) {
      // reportFailure rethrows hard failures; soft failures (MaxStepsExceededError)
      // return so the partial result is delivered
      await this.lifecycle.reportFailure(error, durationMs, context);
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
    let output = '';
    try {
      const executed = await execute(systemPrompt, input);
      output = executed.output;
      if (executed.model) this.reasoningLoop.setModel(executed.model);
    } catch (err) {
      error = err;
      if (err instanceof MaxStepsExceededError) output = err.partialResult;
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
}
