import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockTable = vi.hoisted(() => {
  const mockAdd = vi.fn()
  const mockQuery = vi.fn()
  const mockOpenTable = vi.fn()
  const mockCreateEmptyTable = vi.fn()

  class MockQuery {
    private _limit: number | undefined
    private _filter = ''
    private _orderBy: unknown = null
    limit(n: number) {
      this._limit = n
      return this
    }
    filter(f: string) {
      this._filter = f
      return this
    }
    orderBy(ordering: unknown) {
      this._orderBy = ordering
      return this
    }
    toArray() {
      return mockQuery(this._filter, this._limit, this._orderBy)
    }
  }

  return {
    mockAdd,
    mockQuery,
    mockOpenTable,
    mockCreateEmptyTable,
    MockTable: class MockTable {
      add = mockAdd
      query() {
        return new MockQuery()
      }
    },
  }
})

vi.mock('@lancedb/lancedb', () => ({
  connect: vi.fn().mockResolvedValue({
    openTable: mockTable.mockOpenTable,
    createEmptyTable: mockTable.mockCreateEmptyTable,
  }),
}))

import { LanceDBTraceStore } from '../../../src/memory/LanceDBTraceStore.js'
import { createTraceEnvelope } from '../../../src/core/TraceEnvelope.js'
import type { TraceEnvelope } from '../../../src/core/types.js'

function makeEnvelope(overrides: Partial<TraceEnvelope> = {}): TraceEnvelope {
  return createTraceEnvelope({
    member: 'the-scribe',
    input: 'task',
    output: 'out',
    durationMs: 10,
    tokenCount: { input: 1, output: 1, total: 2 },
    cost: 0.001,
    qualityScore: null,
    status: 'success',
    correlationId: 'corr-1',
    timestamp: '2026-01-01T00:00:00.000Z',
    ...overrides,
  })
}

describe('LanceDBTraceStore', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mockTable.mockOpenTable.mockRejectedValue(new Error('table not found'))
    mockTable.mockCreateEmptyTable.mockResolvedValue(new mockTable.MockTable())
    mockTable.mockQuery.mockResolvedValue([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('connects and creates the traces table when none exists', async () => {
    const store = new LanceDBTraceStore()
    await store.connect('/tmp/test-lancedb')
    expect(mockTable.mockCreateEmptyTable).toHaveBeenCalledWith('traces', expect.anything())
  })

  it('opens an existing traces table when present', async () => {
    mockTable.mockOpenTable.mockResolvedValue(new mockTable.MockTable())
    const store = new LanceDBTraceStore()
    await store.connect('/tmp/test-lancedb')
    expect(mockTable.mockOpenTable).toHaveBeenCalledWith('traces')
    expect(mockTable.mockCreateEmptyTable).not.toHaveBeenCalled()
  })

  it('persists traces with a flat queryable row', async () => {
    const store = new LanceDBTraceStore()
    await store.connect('/tmp/test-lancedb')
    await store.store(makeEnvelope())

    expect(mockTable.mockAdd).toHaveBeenCalledTimes(1)
    const row = mockTable.mockAdd.mock.calls[0][0][0]
    expect(row.member).toBe('the-scribe')
    expect(row.correlation_id).toBe('corr-1')
    expect(row.status).toBe('success')
    expect(row.cost).toBe(0.001)
    expect(row.token_total).toBe(2)
    expect(JSON.parse(row.envelope).member).toBe('the-scribe')
  })

  it('throws when not connected', async () => {
    const store = new LanceDBTraceStore()
    await expect(store.store(makeEnvelope())).rejects.toThrow('not connected')
  })

  it('queries by member', async () => {
    const store = new LanceDBTraceStore()
    await store.connect('/tmp/test-lancedb')
    mockTable.mockQuery.mockResolvedValue([{ envelope: JSON.stringify(makeEnvelope({ member: 'the-scribe' })) }])

    const results = await store.query({ member: 'the-scribe' })
    expect(results).toHaveLength(1)
    expect(results[0].member).toBe('the-scribe')
    expect(mockTable.mockQuery.mock.calls[0][0]).toContain("member = 'the-scribe'")
  })

  it('queries by time range with descending order', async () => {
    const store = new LanceDBTraceStore()
    await store.connect('/tmp/test-lancedb')
    mockTable.mockQuery.mockResolvedValue([])

    await store.query({ since: '2026-01-01T00:00:00.000Z', until: '2026-02-01T00:00:00.000Z' })
    const [filter, limit, orderBy] = mockTable.mockQuery.mock.calls[0]
    expect(filter).toContain("timestamp >= '2026-01-01T00:00:00.000Z'")
    expect(filter).toContain("timestamp <= '2026-02-01T00:00:00.000Z'")
    expect(limit).toBeUndefined()
    expect(orderBy).toEqual([{ columnName: 'timestamp', ascending: false }])
  })

  it('applies limit to queries', async () => {
    const store = new LanceDBTraceStore()
    await store.connect('/tmp/test-lancedb')
    mockTable.mockQuery.mockResolvedValue([])

    await store.query({ limit: 5 })
    expect(mockTable.mockQuery.mock.calls[0][1]).toBe(5)
  })

  it('returns empty when not connected', async () => {
    const store = new LanceDBTraceStore()
    expect(await store.query({ member: 'x' })).toEqual([])
  })
})
