import { join } from 'node:path'

import type { ExecutionContext } from '../../core/ExecutionContext.ts'
import { createTraceEnvelope } from '../../core/TraceEnvelope.ts'
import { CostEstimator } from '../../core/CostEstimator.ts'
import { getMemberQualityScore } from '../../core/qualityScore.ts'
import { reportBackgroundFailure } from '../../core/sentryReporter.ts'

export interface AgentTraceArgs {
  role: string
  model: string
  usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined
  toolUsage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined
  input: string
  output: string
  durationMs: number
  error: unknown
  context: ExecutionContext
}

function redact(context: ExecutionContext, text: string): string {
  // production contexts always carry a redactor built from the observability
  // config (ApplicationContext, eval.ts); fail closed so a misconfigured
  // context can never persist raw payloads silently
  if (!context.redactor) {
    throw new Error('[BaseAgent] redaction requires a redactor on the ExecutionContext')
  }
  return context.redactor.redactText(text)
}

export interface RedactSafelyOptions {
  event: string
  member: string
  model: string
  /** 'throw' fails closed (persisted traces/decisions); 'skip' returns undefined (best-effort signals). */
  mode?: 'throw' | 'skip'
  /** Rethrown instead of the redaction error when the run already failed ('throw' mode only). */
  originalError?: unknown
}

export function redactSafely(
  context: ExecutionContext,
  text: string,
  options: RedactSafelyOptions & { mode?: 'throw' },
): string
export function redactSafely(
  context: ExecutionContext,
  text: string,
  options: RedactSafelyOptions & { mode: 'skip' },
): string | undefined
export function redactSafely(
  context: ExecutionContext,
  text: string,
  options: RedactSafelyOptions,
): string | undefined {
  try {
    return redact(context, text)
  } catch (redactionError) {
    void reportBackgroundFailure(redactionError, context, options.event, { member: options.member, model: options.model })
    if (options.mode === 'skip') return undefined
    // fail closed, but surface the original run error when one exists
    if (options.originalError) throw options.originalError
    throw redactionError
  }
}

const costEstimator = new CostEstimator()

function buildAgentTraceEnvelope(args: AgentTraceArgs) {
  const { role, model, usage, toolUsage, input, output, durationMs, error, context } = args
  // tool-level LLM calls (WriteCode/Refactor/Explain) accumulate here
  const promptTokens = (usage?.promptTokens ?? 0) + (toolUsage?.promptTokens ?? 0)
  const completionTokens = (usage?.completionTokens ?? 0) + (toolUsage?.completionTokens ?? 0)
  const totalTokens = (usage?.totalTokens ?? 0) + (toolUsage?.totalTokens ?? 0)
  return createTraceEnvelope({
    member: role,
    input,
    output,
    durationMs,
    tokenCount: {
      input: promptTokens,
      output: completionTokens,
      total: totalTokens,
    },
    cost: costEstimator.computeCost(
      model,
      promptTokens,
      completionTokens,
    ).estimatedCost,
    qualityScore: getMemberQualityScore(role, join(context.project.localPath, '.agenthood', 'baselines')),
    status: error ? 'error' : 'success',
    correlationId: context.correlationId ?? context.executionId,
    source: context.source,
    model,
  })
}

/** Redacts, builds, and records the run trace; fails closed on redaction. */
export function recordAgentTrace(args: AgentTraceArgs): void {
  // redact before hashing so inputHash/outputHash always match the persisted
  // (redacted) payload; Tracer.record's own pass is a no-op then
  const safeInput = redactSafely(args.context, args.input, { event: 'trace redaction failed', member: args.role, model: args.model, originalError: args.error })
  const safeOutput = redactSafely(args.context, args.output, { event: 'trace redaction failed', member: args.role, model: args.model, originalError: args.error })
  try {
    args.context.tracer.record(buildAgentTraceEnvelope({ ...args, input: safeInput, output: safeOutput }))
  } catch (err) {
    void reportBackgroundFailure(err, args.context, 'trace recording failed', { member: args.role, model: args.model })
  }
}
