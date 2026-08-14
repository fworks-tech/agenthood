import * as lancedb from '@lancedb/lancedb'
import { Field, Float64, Schema, Utf8 } from 'apache-arrow'
import type { TraceEnvelope } from '../core/types.js'
import type { TraceQuery, TraceStore } from '../core/TraceStore.js'
import { escapeLike } from './VectorStore.js'

interface TraceRow {
  id: string
  member: string
  correlation_id: string
  status: string
  timestamp: string
  cost: number
  duration_ms: number
  token_input: number
  token_output: number
  token_total: number
  envelope: string
}

export class LanceDBTraceStore implements TraceStore {
  private db: lancedb.Connection | null = null
  private table: lancedb.Table | null = null
  private tableName = 'traces'

  async connect(path: string): Promise<void> {
    this.db = await lancedb.connect(path)
    try {
      this.table = await this.db.openTable(this.tableName)
    } catch {
      this.table = await this.db.createEmptyTable(
        this.tableName,
        new Schema([
          new Field('id', new Utf8(), false),
          new Field('member', new Utf8(), true),
          new Field('correlation_id', new Utf8(), true),
          new Field('status', new Utf8(), true),
          new Field('timestamp', new Utf8(), true),
          new Field('cost', new Float64(), true),
          new Field('duration_ms', new Float64(), true),
          new Field('token_input', new Float64(), true),
          new Field('token_output', new Float64(), true),
          new Field('token_total', new Float64(), true),
          new Field('envelope', new Utf8(), true),
        ]),
      )
    }
  }

  disconnect(): void {
    this.db?.close()
    this.db = null
    this.table = null
  }

  async store(envelope: TraceEnvelope): Promise<void> {
    if (!this.table) throw new Error('LanceDBTraceStore: not connected. Call connect() first.')
    await this.table.add([this.toRow(envelope)] as unknown as Record<string, unknown>[])
  }

  async query(filters: TraceQuery = {}): Promise<TraceEnvelope[]> {
    if (!this.table) return []

    const where: string[] = []
    if (filters.member) where.push(`member = '${escapeLike(filters.member)}'`)
    if (filters.correlationId) where.push(`correlation_id = '${escapeLike(filters.correlationId)}'`)
    if (filters.since) where.push(`timestamp >= '${escapeLike(filters.since)}'`)
    if (filters.until) where.push(`timestamp <= '${escapeLike(filters.until)}'`)

    let q = this.table.query().orderBy([{ columnName: 'timestamp', ascending: false }])
    if (where.length > 0) q = q.filter(where.join(' AND '))
    if (filters.limit !== undefined && filters.limit >= 0) q = q.limit(filters.limit)

    const rows = (await q.toArray()) as unknown as TraceRow[]
    return rows.map((row) => JSON.parse(row.envelope) as TraceEnvelope)
  }

  private toRow(envelope: TraceEnvelope): TraceRow {
    return {
      id: `${envelope.correlationId}:${envelope.timestamp}:${envelope.member}`,
      member: envelope.member,
      correlation_id: envelope.correlationId,
      status: envelope.status,
      timestamp: envelope.timestamp,
      cost: envelope.cost,
      duration_ms: envelope.durationMs,
      token_input: envelope.tokenCount.input,
      token_output: envelope.tokenCount.output,
      token_total: envelope.tokenCount.total,
      envelope: JSON.stringify(envelope),
    }
  }
}
