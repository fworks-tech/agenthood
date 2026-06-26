import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { IVectorStore, VectorRecord, VectorSearchResult } from '../../../src/memory/VectorStore.js'

const makeMockVectorStore = (): IVectorStore => ({
  add: vi.fn().mockResolvedValue(undefined),
  search: vi.fn(),
  connect: vi.fn(),
  delete: vi.fn().mockResolvedValue(1),
  stats: vi.fn(),
})

describe('LongTermMemoryImpl', () => {
  let mockStore: IVectorStore

  beforeEach(async () => {
    mockStore = makeMockVectorStore()
  })

  it('imports and constructs without error', async () => {
    const { LongTermMemoryImpl } = await import('../../../src/memory/LongTermMemory.js')
    const ltm = new LongTermMemoryImpl(mockStore)
    expect(ltm).toBeDefined()
  })

  it('stores a value by key', async () => {
    const { LongTermMemoryImpl } = await import('../../../src/memory/LongTermMemory.js')
    const ltm = new LongTermMemoryImpl(mockStore)
    await ltm.store('myKey', { data: 'test' })
    expect(mockStore.add).toHaveBeenCalled()
    const added = (mockStore.add as ReturnType<typeof vi.fn>).mock.calls[0][0] as VectorRecord[]
    expect(added[0].id).toContain('ltm:myKey')
  })

  it('retrieves a stored value', async () => {
    const { LongTermMemoryImpl } = await import('../../../src/memory/LongTermMemory.js')
    const ltm = new LongTermMemoryImpl(mockStore)

    vi.mocked(mockStore.search).mockResolvedValue([{
      record: {
        id: 'ltm:myKey',
        vector: [],
        content: JSON.stringify({ data: 'test' }),
        metadata: { key: 'myKey' },
        createdAt: new Date(),
      },
      score: 1,
    }])

    const result = await ltm.retrieve('myKey')
    expect(result).toEqual({ data: 'test' })
  })

  it('returns null for missing key', async () => {
    const { LongTermMemoryImpl } = await import('../../../src/memory/LongTermMemory.js')
    const ltm = new LongTermMemoryImpl(mockStore)
    vi.mocked(mockStore.search).mockResolvedValue([])
    const result = await ltm.retrieve('nonexistent')
    expect(result).toBeNull()
  })

  it('deletes a stored key', async () => {
    const { LongTermMemoryImpl } = await import('../../../src/memory/LongTermMemory.js')
    const ltm = new LongTermMemoryImpl(mockStore)
    const deleted = await ltm.delete('myKey')
    expect(deleted).toBe(1)
    expect(mockStore.delete).toHaveBeenCalledWith({ key: 'myKey' })
  })
})
