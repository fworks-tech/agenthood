import * as lancedb from '@lancedb/lancedb'
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
  add(records: VectorRecord[]): Promise<void>
  search(query: number[], topK: number, filter?: Record<string, unknown>): Promise<VectorSearchResult[]>
  delete(filter: Record<string, unknown>): Promise<number>
  stats(): Promise<{ totalVectors: number; dimension: number }>
}

interface LanceRow {
  id: string
  vector: Float32Array
  content: string
  metadata: string
  created_at: string
  _distance?: number
}

function toSqlFilter(filter: Record<string, unknown>): string {
  const parts: string[] = []
  for (const [key, value] of Object.entries(filter)) {
    const escaped = typeof value === 'string' ? `'${value.replace(/'/g, "''")}'` : String(value)
    parts.push(`metadata LIKE '%"${key}": ${escaped}%'`)
  }
  return parts.join(' AND ')
}

export class LanceDBStore implements IVectorStore, IMemoryStore<VectorRecord> {
  private db: lancedb.Connection | null = null
  private table: lancedb.Table | null = null
  private tableName = 'vectors'

  constructor(private dimension: number = 1536) {}

  async connect(path: string): Promise<void> {
    this.db = await lancedb.connect(path)
    try {
      this.table = await this.db.openTable(this.tableName)
    } catch {
      this.table = await this.db.createTable(this.tableName, [])
    }
  }

  async add(records: VectorRecord[]): Promise<void> {
    if (!this.table) {
      throw new Error('LanceDBStore: not connected. Call connect() first.')
    }
    if (records.length === 0) return
    const rows = records.map((r) => ({
      id: r.id,
      vector: new Float32Array(r.vector),
      content: r.content,
      metadata: JSON.stringify(r.metadata ?? {}),
      created_at: r.createdAt.toISOString(),
    }))
    await this.table.add(rows)
  }

  async search(
    query: number[],
    topK: number,
    filter?: Record<string, unknown>,
  ): Promise<VectorSearchResult[]> {
    if (!this.table) {
      throw new Error('LanceDBStore: not connected. Call connect() first.')
    }
    let q = this.table.vectorSearch(new Float32Array(query)).limit(topK)
    if (filter && Object.keys(filter).length > 0) {
      q = q.filter(toSqlFilter(filter))
    }
    const results = await q.toArray()
    return (results as unknown as LanceRow[]).map((row) => ({
      record: {
        id: row.id,
        vector: Array.from(row.vector),
        content: row.content,
        metadata: JSON.parse(row.metadata),
        createdAt: new Date(row.created_at),
      },
      score: row._distance !== undefined ? 1 - row._distance : 1,
    }))
  }

  async delete(keyOrFilter: string | Record<string, unknown>): Promise<number> {
    if (!this.table) {
      throw new Error('LanceDBStore: not connected. Call connect() first.')
    }
    const filter = typeof keyOrFilter === 'string' ? { id: keyOrFilter } : keyOrFilter
    const sql = Object.keys(filter).length === 0 ? '1=1' : toSqlFilter(filter)
    const result = await this.table.delete(sql)
    return result.numDeletedRows
  }

  async stats(): Promise<{ totalVectors: number; dimension: number; totalEntries: number; oldestEntry: Date | null }> {
    if (!this.table) {
      throw new Error('LanceDBStore: not connected. Call connect() first.')
    }
    const count = await this.table.countRows()
    return { totalVectors: count, dimension: this.dimension, totalEntries: count, oldestEntry: null }
  }

  // IMemoryStore<VectorRecord> implementation

  async set(key: string, value: VectorRecord, _ttlMs?: number): Promise<void> {
    await this.add([value])
  }

  async get(key: string): Promise<VectorRecord | undefined> {
    const results = await this.search([], 1, { id: key })
    return results[0]?.record
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

  async prune(policy: RetentionPolicy): Promise<number> {
    if (!this.table) return 0
    let pruned = 0
    if (policy.maxAgeMs) {
      const cutoff = new Date(Date.now() - policy.maxAgeMs).toISOString()
      const count = await this.table.delete(`created_at < '${cutoff}'`)
      pruned += count.numDeletedRows
    }
    if (policy.maxSize) {
      const s = await this.stats()
      if (s.totalVectors > policy.maxSize) {
        const excess = s.totalVectors - policy.maxSize
        pruned += excess
      }
    }
    return pruned
  }
}
