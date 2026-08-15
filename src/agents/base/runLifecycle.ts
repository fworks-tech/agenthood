import { randomUUID } from 'node:crypto'

import type { ExecutionContext } from '../../core/ExecutionContext.ts'
import type { EvalResult } from '../../core/types.ts'
import { reportErrorToSentry, reportBackgroundFailure } from '../../core/sentryReporter.ts'
import type { EpisodeLearner } from '../../evals/EpisodeLearner.ts'
import type { ResidualMemory } from '../../memory/ResidualMemory.ts'
import type { ReActLoop } from '../../reasoning/ReActLoop.ts'
import { recordAgentTrace, redactSafely } from './agentTrace.ts'

export interface LifecycleHost {
  role: string
  reasoningLoop: ReActLoop
  residualMemory?: ResidualMemory
  episodeLearner?: EpisodeLearner
}

/**
 * Persistence half of the agent lifecycle: tracing, residual memory, episode
 * learning, Sentry reporting, and decision/provenance recording. Kept out of
 * BaseAgent so the execution orchestration stays readable.
 */
export class RunLifecycle {
  constructor(private readonly agent: LifecycleHost) {}

  private get report(): { member: string; model: string } {
    return { member: this.agent.role, model: this.agent.reasoningLoop.model || this.agent.role }
  }

  recordTrace(args: {
    input: string;
    output: string;
    durationMs: number;
    error: unknown;
    context: ExecutionContext;
  }): void {
    recordAgentTrace({
      role: this.agent.role,
      model: this.agent.reasoningLoop.model || 'unknown',
      usage: this.agent.reasoningLoop.usage,
      toolUsage: args.context.usage,
      input: args.input,
      output: args.output,
      durationMs: args.durationMs,
      error: args.error,
      context: args.context,
    });
  }

  recordResidual(input: string, context: ExecutionContext): void {
    // residual is a best-effort learning signal — a redaction failure must
    // not abort the run (trace recording already fails closed on it)
    const residualInput = redactSafely(context, input, { event: 'residual redaction failed', ...this.report, mode: 'skip' });
    if (residualInput === undefined) return;
    this.agent.residualMemory?.record(`agent:${this.agent.role}:${residualInput.slice(0, 80)}`, 0.5);
  }

  learnFromRun(context: ExecutionContext): void {
    const evalResult: EvalResult = {
      episodeId: context.executionId,
      scores: {},
      metadata: { member: this.agent.role },
    };
    this.agent.episodeLearner?.learn(evalResult, context).catch((err) => {
      void reportBackgroundFailure(err, context, 'episode learner failed', this.report);
    });
  }

  async reportFailure(
    error: unknown,
    durationMs: number,
    context: ExecutionContext,
  ): Promise<never> {
    await reportErrorToSentry(error, context, {
      member: this.agent.role,
      model: this.agent.reasoningLoop.model || this.agent.role,
      durationMs,
      status: 'error',
      correlationId: context.correlationId ?? context.executionId,
    });
    throw error;
  }

  async recordRun(
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
    const redact = { event: 'run redaction failed', ...this.report, originalError: error };
    const rationale = redactSafely(context, isSuccessful
      ? 'Member run completed; see decision for output summary.'
      : `Run failed: ${error instanceof Error ? error.message : String(error)}`, redact);
    const safeInput = redactSafely(context, input, redact);
    const safeOutput = redactSafely(context, output, redact);

    try {
      await this.recordDecision({ id, timestamp, safeInput, safeOutput, rationale, isSuccessful, context });
      await this.trackRunProvenance({ id, timestamp, safeInput, isSuccessful, context });
    } catch (err) {
      await reportBackgroundFailure(err, context, 'decision/provenance recording failed', this.report);
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
      member: this.agent.role,
      task: args.safeInput,
      decision: args.safeOutput.slice(0, 2000) || '(no output)',
      rationale: args.rationale,
      alternatives: [],
      outcome: args.isSuccessful ? 'completed' : 'failed',
      tags: ['run'],
      confidence: args.isSuccessful ? 1 : 0,
      decisionMaker: this.agent.role,
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
      entityType: 'decision',
      activityId: `run:${this.agent.role}`,
      agentId: this.agent.role,
      agentType: 'software_agent',
      role: 'generator',
      sourceDocument: args.safeInput.slice(0, 500),
      timestamp: args.timestamp,
      confidence: args.isSuccessful ? 1 : 0,
      metadata: { decisionId: args.id, success: args.isSuccessful },
    });
  }
}
