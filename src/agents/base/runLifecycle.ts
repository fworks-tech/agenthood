import { randomUUID } from 'node:crypto'

import type { ExecutionContext } from '../../core/ExecutionContext.ts'
import type { EvalResult } from '../../core/types.ts'
import { reportErrorToSentry, reportBackgroundFailure } from '../../core/sentryReporter.ts'
import type { EpisodeLearner } from '../../evals/EpisodeLearner.ts'
import type { ResidualMemory } from '../../memory/ResidualMemory.ts'
import type { ReActLoop } from '../../reasoning/ReActLoop.ts'
import { MaxStepsExceededError } from '../../reasoning/ReActLoop.ts'
import { recordAgentTrace, redactSafely } from './agentTrace.ts'

interface RecordDecisionArgs {
  id: string
  timestamp: string
  safeInput: string
  safeOutput: string
  rationale: string
  isSuccessful: boolean
  context: ExecutionContext
}

interface TrackRunProvenanceArgs {
  id: string
  timestamp: string
  safeInput: string
  isSuccessful: boolean
  context: ExecutionContext
}

/**
 * Persistence half of the agent lifecycle: tracing, residual memory, episode
 * learning, Sentry reporting, and decision/provenance recording. Kept out of
 * BaseAgent so the execution orchestration stays readable. `getRole` is a
 * closure because subclass role fields are only set after the base
 * constructor runs.
 */
export class RunLifecycle {
  constructor(
    private readonly getRole: () => string,
    private readonly reasoningLoop: ReActLoop,
    private readonly residualMemory?: ResidualMemory,
    private readonly episodeLearner?: EpisodeLearner,
  ) {}

  private get report(): { member: string; model: string } {
    return { member: this.getRole(), model: this.reasoningLoop.model || this.getRole() }
  }

  recordTrace(args: {
    input: string
    output: string
    durationMs: number
    error: unknown
    context: ExecutionContext
  }): void {
    recordAgentTrace({
      role: this.getRole(),
      model: this.reasoningLoop.model || 'unknown',
      usage: this.reasoningLoop.usage,
      toolUsage: args.context.usage,
      input: args.input,
      output: args.output,
      durationMs: args.durationMs,
      error: args.error,
      context: args.context,
    })
  }

  recordResidual(input: string, context: ExecutionContext): void {
    // residual is a best-effort learning signal — a redaction failure must
    // not abort the run (trace recording already fails closed on it)
    const residualInput = redactSafely(context, input, { event: 'residual redaction failed', ...this.report, mode: 'skip' })
    if (residualInput === undefined) return
    this.residualMemory?.record(`agent:${this.getRole()}:${residualInput.slice(0, 80)}`, 0.5)
  }

  learnFromRun(context: ExecutionContext): void {
    const evalResult: EvalResult = {
      episodeId: context.executionId,
      scores: {},
      metadata: { member: this.getRole() },
    }
    this.episodeLearner?.learn(evalResult, context).catch((err) => {
      void reportBackgroundFailure(err, context, 'episode learner failed', this.report)
    })
  }

  async reportFailure(
    error: unknown,
    durationMs: number,
    context: ExecutionContext,
  ): Promise<never> {
    // MaxStepsExceededError is a soft failure — don't report to Sentry
    if (error instanceof MaxStepsExceededError) {
      throw error
    }
    await reportErrorToSentry(error, context, {
      member: this.getRole(),
      model: this.reasoningLoop.model || this.getRole(),
      durationMs,
      status: 'error',
      correlationId: context.correlationId ?? context.executionId,
    })
    throw error
  }

  async recordRun(
    input: string,
    output: string,
    error: unknown,
    context: ExecutionContext,
  ): Promise<void> {
    const timestamp = new Date().toISOString()
    const id = `dec-${Date.now()}-${randomUUID()}`
    const isSuccessful = error === null

    // decisions and provenance persist raw payloads, so the shared redactor
    // must guard them or the redaction guarantee is only half-true
    const redact = { event: 'run redaction failed', ...this.report, originalError: error }
    const rationale = redactSafely(context, isSuccessful
      ? 'Member run completed; see decision for output summary.'
      : `Run failed: ${error instanceof Error ? error.message : String(error)}`, redact)
    const safeInput = redactSafely(context, input, redact)
    const safeOutput = redactSafely(context, output, redact)

    try {
      await this.recordDecision({ id, timestamp, safeInput, safeOutput, rationale, isSuccessful, context })
      await this.trackRunProvenance({ id, timestamp, safeInput, isSuccessful, context })
    } catch (err) {
      await reportBackgroundFailure(err, context, 'decision/provenance recording failed', this.report)
    }
  }

  private async recordDecision(args: RecordDecisionArgs): Promise<void> {
    await args.context.memory.decisions.record({
      id: args.id,
      timestamp: args.timestamp,
      member: this.getRole(),
      task: args.safeInput.slice(0, 2000),
      decision: args.safeOutput.slice(0, 2000) || '(no output)',
      rationale: args.rationale,
      alternatives: [],
      outcome: args.isSuccessful ? 'completed' : 'failed',
      tags: ['run'],
      confidence: args.isSuccessful ? 1 : 0,
      decisionMaker: this.getRole(),
    })
  }

  private async trackRunProvenance(args: TrackRunProvenanceArgs): Promise<void> {
    await args.context.memory.provenance.track({
      entityId: args.context.executionId,
      entityType: 'decision',
      activityId: `run:${this.getRole()}`,
      agentId: this.getRole(),
      agentType: 'software_agent',
      role: 'generator',
      sourceDocument: args.safeInput.slice(0, 500),
      timestamp: args.timestamp,
      confidence: args.isSuccessful ? 1 : 0,
      metadata: { decisionId: args.id, success: args.isSuccessful },
    })
  }
}
