import type { ExecutionContext } from './ExecutionContext.js'

export interface SentryReportContext {
  member: string
  model: string
  durationMs: number
  status: string
  correlationId: string
}

let initializedDsn: string | null = null

/**
 * Reports a member run failure to Sentry when a DSN is configured. The
 * @sentry/node import is dynamic so disabled installs never load it, and a
 * reporter failure never surfaces to the caller.
 */
export async function reportErrorToSentry(error: unknown, context: ExecutionContext, report: SentryReportContext): Promise<void> {
  const dsn = context.sentry?.dsn
  if (!dsn) return
  try {
    const Sentry = await import('@sentry/node')
    if (initializedDsn !== dsn) {
      Sentry.init({ dsn, tracesSampleRate: 0 })
      initializedDsn = dsn
    }
    // the error object keeps its stack; the message is also shipped redacted
    // so secret-shaped payloads never reach the DSN even if the provider
    // formats the message differently
    const msg = error instanceof Error ? error.message : String(error)
    const safeMsg = context.redactor ? context.redactor.redactText(msg) : msg
    Sentry.captureException(error, {
      tags: { member: report.member, model: report.model, status: report.status },
      extra: { durationMs: report.durationMs, correlationId: report.correlationId, message: safeMsg },
    })
  } catch (err) {
    // reporter failures must never surface to the caller; the debug line
    // keeps the swallow path observable
    console.debug(`[sentry] reporting failed: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export function isDevEnvironment(env: string | undefined = process.env.NODE_ENV): boolean {
  return env === 'development'
}

export interface BackgroundFailureOptions {
  member?: string
  model?: string
}

/**
 * Reports a non-fatal infrastructure failure (trace, decision/provenance, or
 * learner errors) to Sentry and to the console when Sentry is not configured
 * or in development, so visibility survives without a DSN.
 */
export async function reportBackgroundFailure(
  error: unknown,
  context: ExecutionContext,
  event: string,
  options: BackgroundFailureOptions = {},
): Promise<void> {
  await reportErrorToSentry(error, context, {
    member: options.member ?? 'system',
    model: options.model ?? 'unknown',
    durationMs: 0,
    status: 'error',
    correlationId: context.correlationId ?? context.executionId,
  })
  if (isDevEnvironment() || !context.sentry?.dsn) {
    console.error(`[${event}] ${error instanceof Error ? error.message : String(error)}`)
  }
}
