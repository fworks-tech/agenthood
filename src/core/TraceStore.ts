import { existsSync, readFileSync, mkdirSync, writeFileSync, renameSync } from 'node:fs'
import { appendFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { TraceEnvelope } from './types.js'

export interface TraceQuery {
  member?: string
  correlationId?: string
  since?: string
  until?: string
  limit?: number
}

export interface TraceStore {
  store(envelope: TraceEnvelope): Promise<void>
  query(filters?: TraceQuery): Promise<TraceEnvelope[]>
}

export interface TraceRetentionPolicy {
  /** Traces older than this are pruned; 0 or negative disables TTL pruning */
  ttlMs: number
  /** Maximum entries kept, oldest pruned first; undefined keeps all */
  maxEntries?: number
  exportEnabled?: boolean
  /** NDJSON destination for pruned traces */
  exportPath?: string
}

export interface PruneResult {
  pruned: number
  exported: number
  exportPath?: string
  remaining: number
}

/**
 * File-based trace persistence (NDJSON, one envelope per line).
 * Loads existing traces on construction and appends on store.
 */
export class JSONFileTraceStore implements TraceStore {
  private cached: TraceEnvelope[] = []

  constructor(private filePath: string) {
    mkdirSync(dirname(filePath), { recursive: true })
    this.load()
  }

  private load(): void {
    if (!existsSync(this.filePath)) return
    try {
      const content = readFileSync(this.filePath, 'utf8')
      for (const line of content.split('\n')) {
        if (line.trim() === '') continue
        try {
          this.cached.push(JSON.parse(line) as TraceEnvelope)
        } catch {
          // skip corrupt lines — retention/export can repair later
        }
      }
    } catch {
      // unreadable file behaves as empty
    }
  }

  async store(envelope: TraceEnvelope): Promise<void> {
    this.cached.push(envelope)
    // owner-only permissions: trace payloads may contain PII and secrets
    await appendFile(this.filePath, `${JSON.stringify(envelope)}\n`, { encoding: 'utf8', mode: 0o600 })
  }

  async query(filters: TraceQuery = {}): Promise<TraceEnvelope[]> {
    let result = this.cached.slice()
    if (filters.member) result = result.filter((e) => e.member === filters.member)
    if (filters.correlationId) result = result.filter((e) => e.correlationId === filters.correlationId)
    if (filters.since) result = result.filter((e) => e.timestamp >= filters.since!)
    if (filters.until) result = result.filter((e) => e.timestamp <= filters.until!)
    result.sort((a, b) => (a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0))
    if (filters.limit !== undefined && filters.limit >= 0) result = result.slice(0, filters.limit)
    return result
  }

  /**
   * Removes traces older than the policy TTL and beyond the entry cap,
   * exporting the pruned envelopes to NDJSON before they are deleted.
   */
  async prune(policy: TraceRetentionPolicy): Promise<PruneResult> {
    const cutoff = policy.ttlMs > 0 ? Date.now() - policy.ttlMs : null
    let kept = this.cached
    if (cutoff !== null) {
      kept = kept.filter((e) => new Date(e.timestamp).getTime() >= cutoff)
    }
    const cap = policy.maxEntries !== undefined && policy.maxEntries > 0 ? policy.maxEntries : undefined
    if (cap !== undefined && kept.length > cap) {
      kept = kept.slice(-cap)
    }
    const pruned = this.cached.filter((e) => !kept.includes(e))
    const result: PruneResult = { pruned: pruned.length, exported: 0, remaining: kept.length }

    if (pruned.length > 0) {
      if (policy.exportEnabled === true && policy.exportPath) {
        mkdirSync(dirname(policy.exportPath), { recursive: true })
        await appendFile(policy.exportPath, `${pruned.map((e) => JSON.stringify(e)).join('\n')}\n`, { encoding: 'utf8', mode: 0o600 })
        result.exported = pruned.length
        result.exportPath = policy.exportPath
      }
      this.cached = kept
      const next = kept.length > 0 ? `${kept.map((e) => JSON.stringify(e)).join('\n')}\n` : ''
      const tmpPath = `${this.filePath}.tmp`
      writeFileSync(tmpPath, next, { encoding: 'utf8', mode: 0o600 })
      renameSync(tmpPath, this.filePath)
    }
    return result
  }
}

/** Schedules retention pruning on a fixed cadence; the timer never keeps the process alive. */
export class RetentionManager {
  private timer: NodeJS.Timeout | null = null

  constructor(
    private readonly store: JSONFileTraceStore,
    private readonly policy: TraceRetentionPolicy,
    private readonly intervalMs = 3_600_000,
  ) {}

  async prune(): Promise<PruneResult> {
    return this.store.prune(this.policy)
  }

  start(): void {
    if (this.timer) return
    const timer = setInterval(() => {
      this.prune().catch((err) => {
        console.error(`[retention] prune failed: ${err instanceof Error ? err.message : String(err)}`)
      })
    }, this.intervalMs)
    timer.unref()
    this.timer = timer
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }
}

/** Builds a retention policy from a parsed `observability.retention` config block. */
export function createRetentionPolicyFromConfig(raw: unknown): TraceRetentionPolicy | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const block = (raw as Record<string, unknown>).observability
  if (typeof block !== 'object' || block === null) return undefined
  const retention = (block as Record<string, unknown>).retention
  if (typeof retention !== 'object' || retention === null) return undefined
  const r = retention as Record<string, unknown>
  const ttlDays = typeof r.ttlDays === 'number' ? r.ttlDays : 0
  return {
    ttlMs: ttlDays * 86_400_000,
    maxEntries: typeof r.maxEntries === 'number' ? r.maxEntries : undefined,
    exportEnabled: r.exportEnabled === true,
    exportPath: typeof r.exportPath === 'string' ? r.exportPath : undefined,
  }
}
