import { existsSync, readFileSync, mkdirSync } from 'node:fs'
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
    await appendFile(this.filePath, `${JSON.stringify(envelope)}\n`, 'utf8')
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
}
