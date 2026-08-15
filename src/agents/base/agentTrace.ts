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

/**
 * Redacts a payload, reporting failures as background errors. `mode: 'throw'`
 * fails closed (used for persisted traces/decisions) and rethrows
 * `originalError` when one exists; `mode: 'skip'` returns undefined instead
 * (used for best-effort signals like residual memory — `originalError` is
 * ignored in that mode).
 */
export function redactSafely(
  context: ExecutionContext,
  text: string,
  event: string,
  report: { member: string; model: string },
  mode: 'skip',
  originalError?: unknown,
): string | undefined
export function redactSafely(
  context: ExecutionContext,
  text: string,
  event: string,
  report: { member: string; model: string },
  mode?: 'throw',
  originalError?: unknown,
): string
export function redactSafely(
  context: ExecutionContext,
  text: string,
  event: string,
  report: { member: string; model: string },
  mode: 'throw' | 'skip' = 'throw',
  originalError?: unknown,
): string | undefined {
  try {
    return redact(context, text)
  } catch (redactionError) {
    void reportBackgroundFailure(redactionError, context, event, report)
    if (mode === 'skip') return undefined
    // fail closed, but surface the original run error when one exists
    if (originalError) throw originalError
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
  const safeInput = redactSafely(args.context, args.input, 'trace redaction failed', { member: args.role, model: args.model }, 'throw', args.error)
  const safeOutput = redactSafely(args.context, args.output, 'trace redaction failed', { member: args.role, model: args.model }, 'throw', args.error)
  try {
    args.context.tracer.record(buildAgentTraceEnvelope({ ...args, input: safeInput, output: safeOutput }))
  } catch (err) {
    void reportBackgroundFailure(err, args.context, 'trace recording failed', { member: args.role, model: args.model })
  }
}
