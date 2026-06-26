import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { IVectorStore } from '../../../src/memory/VectorStore.js'

const makeMockVectorStore = (): IVectorStore => ({
  add: vi.fn().mockResolvedValue(undefined),
  search: vi.fn(),
  connect: vi.fn(),
  delete: vi.fn(),
  stats: vi.fn(),
})

describe('EpisodicMemoryImpl', () => {
  let mockStore: IVectorStore

  beforeEach(() => {
    mockStore = makeMockVectorStore()
  })

  it('records an episode', async () => {
    const { EpisodicMemoryImpl } = await import('../../../src/memory/EpisodicMemory.js')
    const em = new EpisodicMemoryImpl(mockStore)
    await em.record('fixed bug in auth', 'success')
    expect(mockStore.add).toHaveBeenCalled()
  })

  it('recalls episodes by query', async () => {
    const { EpisodicMemoryImpl } = await import('../../../src/memory/EpisodicMemory.js')
    const em = new EpisodicMemoryImpl(mockStore)

    vi.mocked(mockStore.search).mockResolvedValue([
      {
        record: {
          id: 'ep:1',
          vector: [],
          content: JSON.stringify({ episode: 'fixed bug in auth', outcome: 'success', timestamp: '2025-01-01' }),
          metadata: {},
          createdAt: new Date(),
        },
        score: 0.9,
      },
    ])

    const results = await em.recall('auth bug')
    expect(results).toHaveLength(1)
    expect(results[0]).toContain('fixed bug in auth')
  })

  it('returns empty array when no matching episodes', async () => {
    const { EpisodicMemoryImpl } = await import('../../../src/memory/EpisodicMemory.js')
    const em = new EpisodicMemoryImpl(mockStore)
    vi.mocked(mockStore.search).mockResolvedValue([])

    const results = await em.recall('nonexistent')
    expect(results).toHaveLength(0)
  })
})
