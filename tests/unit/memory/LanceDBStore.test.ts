import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockTable = vi.hoisted(() => {
  const mockAdd = vi.fn()
  const mockVectorSearch = vi.fn()
  const mockDelete = vi.fn()
  const mockCountRows = vi.fn()
  const mockOpenTable = vi.fn()
  const mockCreateTable = vi.fn()

  class MockVectorQuery {
    private _limit = 0
    private _filter = ''
    limit(n: number) {
      this._limit = n
      return this
    }
    filter(f: string) {
      this._filter = f
      return this
    }
    toArray() {
      return mockVectorSearch(this._limit, this._filter)
    }
  }

  return {
    mockAdd,
    mockVectorSearch,
    mockDelete,
    mockCountRows,
    mockOpenTable,
    mockCreateTable,
    MockTable: class MockTable {
      add = mockAdd
      delete = mockDelete
      countRows = mockCountRows
      vectorSearch(_vec: Float32Array) {
        return new MockVectorQuery()
      }
    },
  }
})

vi.mock('@lancedb/lancedb', () => ({
  connect: vi.fn().mockResolvedValue({
    openTable: mockTable.mockOpenTable,
    createTable: mockTable.mockCreateTable,
  }),
}))

import { LanceDBStore } from '../../../src/memory/VectorStore.js'

function makeRecord(
  overrides: Partial<import('../../../src/memory/VectorStore.js').VectorRecord> = {},
) {
  return {
    id: 'vec-1',
    vector: [0.1, 0.2, 0.3],
    content: 'test content',
    metadata: { type: 'test' },
    createdAt: new Date('2026-01-01'),
    ...overrides,
  }
}

describe('LanceDBStore', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mockTable.mockOpenTable.mockRejectedValue(new Error('table not found'))
    mockTable.mockCreateTable.mockResolvedValue(new mockTable.MockTable())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('connects and creates table when none exists', async () => {
    const s = new LanceDBStore(3)
    await s.connect('/tmp/test-lancedb')
    expect(mockTable.mockCreateTable).toHaveBeenCalledWith('vectors', [])
  })

  it('opens existing table when one exists', async () => {
    mockTable.mockOpenTable.mockResolvedValue(new mockTable.MockTable())

    const s = new LanceDBStore(3)
    await s.connect('/tmp/test-lancedb')

    expect(mockTable.mockOpenTable).toHaveBeenCalledWith('vectors')
    expect(mockTable.mockCreateTable).not.toHaveBeenCalled()
  })

  it('adds records to the table', async () => {
    const s = new LanceDBStore(3)
    await s.connect('/tmp/test-lancedb')
    const record = makeRecord()
    await s.add([record])

    expect(mockTable.mockAdd).toHaveBeenCalledTimes(1)
    const rows = mockTable.mockAdd.mock.calls[0][0]
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe('vec-1')
    expect(rows[0].content).toBe('test content')
    expect(rows[0].metadata).toBe('{"type":"test"}')
  })

  it('is a no-op when adding empty array', async () => {
    const s = new LanceDBStore(3)
    await s.connect('/tmp/test-lancedb')
    await s.add([])
    expect(mockTable.mockAdd).not.toHaveBeenCalled()
  })

  it('returns search results sorted by score', async () => {
    mockTable.mockVectorSearch.mockResolvedValue([
      {
        id: 'a',
        vector: new Float32Array([0.1, 0.2, 0.3]),
        content: 'a',
        metadata: '{}',
        created_at: '2026-01-01T00:00:00.000Z',
        _distance: 0.1,
      },
      {
        id: 'b',
        vector: new Float32Array([0.4, 0.5, 0.6]),
        content: 'b',
        metadata: '{}',
        created_at: '2026-01-01T00:00:00.000Z',
        _distance: 0.5,
      },
    ])

    const s = new LanceDBStore(3)
    await s.connect('/tmp/test-lancedb')
    const results = await s.search([0.1, 0.2, 0.3], 10)
    expect(results).toHaveLength(2)
    expect(results[0].record.id).toBe('a')
    expect(results[0].score).toBeCloseTo(0.9)
  })

  it('respects topK limit in search', async () => {
    mockTable.mockVectorSearch.mockResolvedValue([
      {
        id: 'a',
        vector: new Float32Array([0.1, 0.2, 0.3]),
        content: 'a',
        metadata: '{}',
        created_at: '2026-01-01T00:00:00.000Z',
        _distance: 0.1,
      },
    ])

    const s = new LanceDBStore(3)
    await s.connect('/tmp/test-lancedb')
    const results = await s.search([0.1, 0.2, 0.3], 1)
    expect(results).toHaveLength(1)
  })

  it('applies metadata filter in search', async () => {
    mockTable.mockVectorSearch.mockResolvedValue([])

    const s = new LanceDBStore(3)
    await s.connect('/tmp/test-lancedb')
    await s.search([0.1, 0.2, 0.3], 10, { type: 'test' })
    expect(mockTable.mockVectorSearch).toHaveBeenCalled()
  })

  it('returns empty array when no matches', async () => {
    mockTable.mockVectorSearch.mockResolvedValue([])

    const s = new LanceDBStore(3)
    await s.connect('/tmp/test-lancedb')
    const results = await s.search([0.1, 0.2, 0.3], 10)
    expect(results).toHaveLength(0)
  })

  it('deletes records matching filter', async () => {
    mockTable.    mockDelete.mockResolvedValue({ numDeletedRows: 2, version: 1 })

    const s = new LanceDBStore(3)
    await s.connect('/tmp/test-lancedb')
    const count = await s.delete({ type: 'test' })
    expect(count).toBe(2)
    expect(mockTable.mockDelete).toHaveBeenCalled()
  })

  it('returns stats', async () => {
    mockTable.mockCountRows.mockResolvedValue(5)

    const s = new LanceDBStore(3)
    await s.connect('/tmp/test-lancedb')
    const stats = await s.stats()
    expect(stats.totalVectors).toBe(5)
    expect(stats.dimension).toBe(3)
  })

  it('throws when calling add without connect', async () => {
    const s = new LanceDBStore(3)
    await expect(s.add([makeRecord()])).rejects.toThrow('not connected')
  })

  it('throws when calling search without connect', async () => {
    const s = new LanceDBStore(3)
    await expect(s.search([0.1, 0.2, 0.3], 10)).rejects.toThrow('not connected')
  })

  describe('IMemoryStore adapter', () => {
    it('set delegates to add', async () => {
      const s = new LanceDBStore(3)
      await s.connect('/tmp/test-lancedb')
      const record = makeRecord()
      await s.set('vec-1', record)
      expect(mockTable.mockAdd).toHaveBeenCalledTimes(1)
    })

    it('get returns record by id', async () => {
      mockTable.mockVectorSearch.mockResolvedValue([{
        id: 'vec-1',
        vector: new Float32Array([0.1, 0.2, 0.3]),
        content: 'test content',
        metadata: '{"type":"test"}',
        created_at: '2026-01-01T00:00:00.000Z',
        _distance: 0.0,
      }])

      const s = new LanceDBStore(3)
      await s.connect('/tmp/test-lancedb')
      const result = await s.get('vec-1')
      expect(result).toBeDefined()
      expect(result!.id).toBe('vec-1')
      expect(result!.content).toBe('test content')
      expect(result!.metadata).toEqual({ type: 'test' })
    })

    it('get returns undefined for missing id', async () => {
      mockTable.mockVectorSearch.mockResolvedValue([])

      const s = new LanceDBStore(3)
      await s.connect('/tmp/test-lancedb')
      const result = await s.get('nonexistent')
      expect(result).toBeUndefined()
    })

    it('has returns true when record exists', async () => {
      mockTable.mockVectorSearch.mockResolvedValue([{
        id: 'vec-1',
        vector: new Float32Array([0.1, 0.2, 0.3]),
        content: 'test',
        metadata: '{}',
        created_at: '2026-01-01T00:00:00.000Z',
      }])

      const s = new LanceDBStore(3)
      await s.connect('/tmp/test-lancedb')
      const result = await s.has('vec-1')
      expect(result).toBe(true)
    })

    it('has returns false when record missing', async () => {
      mockTable.mockVectorSearch.mockResolvedValue([])

      const s = new LanceDBStore(3)
      await s.connect('/tmp/test-lancedb')
      const result = await s.has('nonexistent')
      expect(result).toBe(false)
    })

    it('clear deletes all records', async () => {
      mockTable.mockDelete.mockResolvedValue({ numDeletedRows: 3, version: 1 })

      const s = new LanceDBStore(3)
      await s.connect('/tmp/test-lancedb')
      await s.clear()
      expect(mockTable.mockDelete).toHaveBeenCalledWith('1=1')
    })

    it('size returns total vector count', async () => {
      mockTable.mockCountRows.mockResolvedValue(5)

      const s = new LanceDBStore(3)
      await s.connect('/tmp/test-lancedb')
      const result = await s.size()
      expect(result).toBe(5)
    })

    it('delete by string key uses id column predicate', async () => {
      mockTable.mockDelete.mockResolvedValue({ numDeletedRows: 1, version: 1 })

      const s = new LanceDBStore(3)
      await s.connect('/tmp/test-lancedb')
      const count = await s.delete('vec-1')
      expect(count).toBe(1)
      expect(mockTable.mockDelete).toHaveBeenCalledWith("id = 'vec-1'")
    })

    it('delete escapes single quotes in string key', async () => {
      mockTable.mockDelete.mockResolvedValue({ numDeletedRows: 0, version: 1 })

      const s = new LanceDBStore(3)
      await s.connect('/tmp/test-lancedb')
      await s.delete("it's")
      expect(mockTable.mockDelete).toHaveBeenCalledWith("id = 'it''s'")
    })

    it('throws on get without connect', async () => {
      const s = new LanceDBStore(3)
      await expect(s.get('x')).rejects.toThrow('not connected')
    })

    it('throws on delete without connect', async () => {
      const s = new LanceDBStore(3)
      await expect(s.delete('x')).rejects.toThrow('not connected')
    })
  })
})
