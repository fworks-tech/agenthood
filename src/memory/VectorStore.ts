import * as lancedb from '@lancedb/lancedb'

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

export class LanceDBStore implements IVectorStore {
  private db: lancedb.Connection | null = null
  private table: lancedb.Table | null = null
  private tableName = 'vectors'

  constructor(private dimension: number = 1536) {}

  async connect(path: string): Promise<void> {
    this.db = await lancedb.connect(path)
    try {
      this.table = await this.db.openTable(this.tableName)
    } catch {
      this.table = await this.db.createTable(this.tableName, [], 'overwrite')
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

  async delete(filter: Record<string, unknown>): Promise<number> {
    if (!this.table) {
      throw new Error('LanceDBStore: not connected. Call connect() first.')
    }
    const sql = toSqlFilter(filter)
    const result = await this.table.delete(sql)
    return result.num_deleted_rows
  }

  async stats(): Promise<{ totalVectors: number; dimension: number }> {
    if (!this.table) {
      throw new Error('LanceDBStore: not connected. Call connect() first.')
    }
    const count = await this.table.countRows()
    return { totalVectors: count, dimension: this.dimension }
  }
}
