/**
 * src/core/Logger.ts
 *
 * First-class logging built on the existing trace infrastructure: log entries
 * are TraceEnvelopes discriminated by `entryType: 'log'` and persisted to the
 * same NDJSON store (`.agenthood/traces/traces.ndjson`) that the Tracer and
 * RetentionManager already own. Zero new runtime dependencies.
 *
 * Existing `console.*` calls are untouched — `log()` is the recommended
 * replacement, not a hard migration.
 */

import { randomUUID } from 'node:crypto'
import { JSONFileTraceStore, loadObservabilityConfig, resolveTraceStorePath } from './TraceStore.ts'
import { createRedactionFilterFromConfig, RedactionFilter } from './RedactionFilter.ts'
import type { TraceEnvelope, TraceSource, LogLevel } from './types.ts'
import type { RunEventBus } from './RunEventBus.ts'

export interface LoggerOptions {
  /** Project root; defaults to process.cwd(). */
  projectPath?: string
  /** Parsed config; defaults to the project's `.agenthood/config.json`. */
  config?: Record<string, unknown>
  source?: TraceSource
  /** Correlation id attached to every entry; a new one is generated per Logger. */
  correlationId?: string
  /** Optional live bus — emits `log.created` when provided. */
  events?: RunEventBus
  /** Overrides the redactor derived from config (test seam, explicit policy). */
  redactor?: RedactionFilter
}

export interface AgenthoodLogger {
  log(level: LogLevel, message: string, member?: string, metadata?: Record<string, unknown>): Promise<void>
  debug(message: string, member?: string, metadata?: Record<string, unknown>): Promise<void>
  info(message: string, member?: string, metadata?: Record<string, unknown>): Promise<void>
  warn(message: string, member?: string, metadata?: Record<string, unknown>): Promise<void>
  error(message: string, member?: string, metadata?: Record<string, unknown>): Promise<void>
}

const LOG_STORE_CACHE = new Map<string, JSONFileTraceStore>()

function storeFor(filePath: string): JSONFileTraceStore {
  let store = LOG_STORE_CACHE.get(filePath)
  if (!store) {
    store = new JSONFileTraceStore(filePath)
    LOG_STORE_CACHE.set(filePath, store)
  }
  return store
}

/**
 * Appends a log entry as a TraceEnvelope to the shared NDJSON store.
 * Non-fatal: a persistence failure is reported to the console but never
 * throws, so logging can never break the caller.
 */
export class Logger implements AgenthoodLogger {
  private readonly filePath: string
  private readonly source: TraceSource
  private readonly correlationId: string
  private readonly events?: RunEventBus
  private readonly redactor: RedactionFilter

  constructor(options: LoggerOptions = {}) {
    const projectPath = options.projectPath ?? process.cwd()
    const config = options.config ?? loadObservabilityConfig(projectPath)
    this.filePath = resolveTraceStorePath(projectPath, config)
    this.source = options.source ?? 'cli'
    this.correlationId = options.correlationId ?? randomUUID()
    this.events = options.events
    // always provide a redactor (enabled by default) so raw payloads never
    // reach the store/bus even when config carries no observability block
    this.redactor = options.redactor ?? createRedactionFilterFromConfig(config) ?? new RedactionFilter()
  }

  async log(level: LogLevel, message: string, member?: string, metadata?: Record<string, unknown>): Promise<void> {
    const envelope: TraceEnvelope = {
      member: member ?? 'system',
      entryType: 'log',
      level,
      message,
      metadata,
      inputHash: '',
      outputHash: '',
      durationMs: 0,
      tokenCount: { input: 0, output: 0, total: 0 },
      cost: 0,
      qualityScore: null,
      status: 'success',
      correlationId: this.correlationId,
      timestamp: new Date().toISOString(),
      source: this.source,
    }

    // Persist and emit the redacted form so secrets never reach the store or
    // the live bus; a deterministic placeholder keeps replay faithful.
    // Redaction is best-effort: a failure degrades to an unredacted entry plus
    // a warning, never a throw to the caller (logging must not break callers).
    let stored: TraceEnvelope
    try {
      stored = this.redactor.redact(envelope)
    } catch (err) {
      console.warn(`[logger] redaction failed, persisting unredacted: ${err instanceof Error ? err.message : String(err)}`)
      stored = envelope
    }

    this.events?.emit({
      type: 'log.created',
      executionId: this.correlationId,
      member: stored.member,
      correlationId: this.correlationId,
      timestamp: stored.timestamp,
      level,
      message: stored.message ?? '',
    })

    try {
      await storeFor(this.filePath).store(stored)
    } catch (err) {
      console.error(`[logger] failed to persist ${level} log entry: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  debug(message: string, member?: string, metadata?: Record<string, unknown>): Promise<void> {
    return this.log('debug', message, member, metadata)
  }

  info(message: string, member?: string, metadata?: Record<string, unknown>): Promise<void> {
    return this.log('info', message, member, metadata)
  }

  warn(message: string, member?: string, metadata?: Record<string, unknown>): Promise<void> {
    return this.log('warn', message, member, metadata)
  }

  error(message: string, member?: string, metadata?: Record<string, unknown>): Promise<void> {
    return this.log('error', message, member, metadata)
  }
}