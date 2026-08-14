import * as lancedb from '@lancedb/lancedb'
import { Field, FixedSizeList, Float32, Schema, Utf8 } from 'apache-arrow'
import type { IMemoryStore, RetentionPolicy } from './IMemoryStore.js'

export interface VectorRecord {
  id: string
  vector: number[]
  metadata?: Record<string, unknown>
  content: string
  createdAt: Date
}

export interface VectorSearchResult {
  record: VectorRecord
  score: number
}

export interface IVectorStore {
  connect(path: string): Promise<void>
  disconnect(): void
  add(records: VectorRecord[]): Promise<void>
  search(query: number[], topK: number, filter?: Record<string, unknown>): Promise<VectorSearchResult[]>
  delete(keyOrFilter: string | Record<string, unknown>): Promise<number>
  stats(): Promise<{ totalVectors: number; dimension: number; totalEntries: number; oldestEntry: Date | null }>
  getById(id: string): Promise<VectorRecord | null>
  getByKeyPrefix(prefix: string, limit?: number): Promise<VectorRecord[]>
}

export function escapeLike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_').replace(/'/g, "''")
}

/** Builds a metadata LIKE clause for the given equality filters. */
export function toSqlFilter(filter: Record<string, unknown>): string {
  const parts: string[] = []
  for (const [key, value] of Object.entries(filter)) {
    const safeKey = escapeLike(key)
    // metadata is JSON.stringify'd, so values carry their JSON quoting
    parts.push(`metadata LIKE '%"${safeKey}":${escapeLike(JSON.stringify(value))}%'`)
  }
  return parts.join(' AND ')
}

interface LanceRow {
  id: string
  vector: Float32Array
  content: string
  metadata: string
  created_at: string
  _distance?: number
}

export class LanceDBStore implements IVectorStore, IMemoryStore<VectorRecord> {
  private db: lancedb.Connection | null = null
  private table: lancedb.Table | null = null
  private tableName = 'vectors'

  constructor(private dimension: number = 1536) {}

  private assertConnected(): void {
    if (!this.table) {
      throw new Error('LanceDBStore: not connected. Call connect() first.')
    }
  }

  async connect(path: string): Promise<void> {
    this.db = await lancedb.connect(path)
    try {
      this.table = await this.db.openTable(this.tableName)
    } catch {
      this.table = await this.db.createEmptyTable(
        this.tableName,
        new Schema([
          new Field('id', new Utf8(), false),
          new Field('vector', new FixedSizeList(this.dimension, new Field('item', new Float32())), true),
          new Field('content', new Utf8(), true),
          new Field('metadata', new Utf8(), true),
          new Field('created_at', new Utf8(), true),
        ]),
      )
    }
  }

  disconnect(): void {
    this.db?.close()
    this.db = null
    this.table = null
  }

  async add(records: VectorRecord[]): Promise<void> {
    this.assertConnected()
    if (records.length === 0) return
    const rows = records.map((r) => ({
      id: r.id,
      vector: new Float32Array(r.vector),
      content: r.content,
      metadata: JSON.stringify(r.metadata ?? {}),
      created_at: r.createdAt.toISOString(),
    }))
    await this.table!.add(rows)
  }

  async search(
    query: number[],
    topK: number,
    filter?: Record<string, unknown>,
  ): Promise<VectorSearchResult[]> {
    this.assertConnected()
    let q = this.table!.vectorSearch(new Float32Array(query)).limit(topK)
    if (filter && Object.keys(filter).length > 0) {
      q = q.filter(toSqlFilter(filter))
    }
    const results = await q.toArray()
    return (results as unknown as LanceRow[]).map((row) => ({
      record: this.rowToRecord(row),
      score: row._distance !== undefined ? 1 - row._distance : 1,
    }))
  }

  async delete(keyOrFilter: string | Record<string, unknown>): Promise<number> {
    this.assertConnected()
    let sql: string
    if (typeof keyOrFilter === 'string') {
      const escaped = escapeLike(keyOrFilter)
      sql = `id = '${escaped}'`
    } else {
      sql = Object.keys(keyOrFilter).length === 0 ? '1=1' : toSqlFilter(keyOrFilter)
    }
    const result = await this.table!.delete(sql)
    return result.numDeletedRows
  }

  async stats(): Promise<{ totalVectors: number; dimension: number; totalEntries: number; oldestEntry: Date | null }> {
    this.assertConnected()
    const count = await this.table!.countRows()
    return { totalVectors: count, dimension: this.dimension, totalEntries: count, oldestEntry: null }
  }

  private rowToRecord(row: LanceRow): VectorRecord {
    return {
      id: row.id,
      vector: Array.from(row.vector),
      content: row.content,
      metadata: JSON.parse(row.metadata),
      createdAt: new Date(row.created_at),
    }
  }

  async set(key: string, value: VectorRecord, _ttlMs?: number): Promise<void> {
    await this.add([value])
  }

  async get(key: string): Promise<VectorRecord | undefined> {
    this.assertConnected()
    const escaped = escapeLike(key)
    const rows = await this.table!
      .query()
      .filter(`id = '${escaped}'`)
      .limit(1)
      .toArray()
    const results = rows as unknown as LanceRow[]
    if (results.length === 0) return undefined
    return this.rowToRecord(results[0])
  }

  async has(key: string): Promise<boolean> {
    const result = await this.get(key)
    return result !== undefined
  }

  async clear(): Promise<void> {
    await this.delete({})
  }

  async size(): Promise<number> {
    const s = await this.stats()
    return s.totalVectors
  }

  async getById(id: string): Promise<VectorRecord | null> {
    const result = await this.get(id)
    return result ?? null
  }

  async getByKeyPrefix(prefix: string, limit = 100): Promise<VectorRecord[]> {
    this.assertConnected()
    const escaped = escapeLike(prefix)
    const rows = await this.table!
      .query()
      .filter(`id LIKE '${escaped}%'`)
      .limit(limit)
      .toArray()
    return (rows as unknown as LanceRow[]).map((r) => this.rowToRecord(r))
  }

  private async removeOldestRecords(count: number): Promise<number> {
    const rows = await this.table!
      .query()
      .orderBy([{ columnName: 'created_at', ascending: true }])
      .limit(count)
      .toArray() as unknown as LanceRow[]
    if (rows.length === 0) return 0
    const ids = rows.map((r) => `'${escapeLike(r.id)}'`).join(',')
    const result = await this.table!.delete(`id IN (${ids})`)
    return result.numDeletedRows
  }

  async prune(policy: RetentionPolicy): Promise<number> {
    if (!this.table) return 0
    let pruned = 0
    if (policy.maxAgeMs) {
      const cutoff = new Date(Date.now() - policy.maxAgeMs).toISOString()
      const count = await this.table!.delete(`created_at < '${escapeLike(cutoff)}'`)
      pruned += count.numDeletedRows
    }
    if (policy.maxSize) {
      const s = await this.stats()
      if (s.totalVectors > policy.maxSize) {
        const excess = s.totalVectors - policy.maxSize
        pruned += await this.removeOldestRecords(excess)
      }
    }
    return pruned
  }
}
