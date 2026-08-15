import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { IVectorStore, VectorRecord, VectorSearchResult } from '../../../src/memory/VectorStore.ts'
import { EmbeddingIndex, INDEX_VERSION_KEY, INDEX_CURRENT_VERSION } from '../../../src/evals/EmbeddingIndex.ts'
import { hashPattern } from '../../../src/utils/hash.ts'

const mockVectorStore: IVectorStore = {
  connect: vi.fn(),
  add: vi.fn(),
  search: vi.fn(),
  delete: vi.fn(),
  stats: vi.fn(),
  getById: vi.fn(),
  getByKeyPrefix: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
})

function makeRecord(id: string, content: string): VectorRecord {
  return {
    id,
    vector: [1, 0, 0],
    content,
    metadata: { type: 'learned_pattern' },
    createdAt: new Date(),
  }
}

function makeSearchResult(content: string, score: number): VectorSearchResult {
  return { record: makeRecord(`pattern:${hashPattern(content)}`, content), score }
}

describe('EmbeddingIndex.storePattern', () => {
  it('persists a pattern with a derived pattern: key and the pattern text as content', async () => {
    vi.mocked(mockVectorStore.getById).mockResolvedValue(null)
    const index = new EmbeddingIndex(mockVectorStore)

    const key = await index.storePattern('learned:architect:write-code:auth', [0.1, 0.2, 0.3])

    expect(key).toBe(`pattern:${hashPattern('learned:architect:write-code:auth')}`)
    expect(mockVectorStore.add).toHaveBeenCalledOnce()
    const [records] = vi.mocked(mockVectorStore.add).mock.calls[0] as [VectorRecord[]]
    expect(records[0].id).toBe(key)
    expect(records[0].content).toBe('learned:architect:write-code:auth')
    expect(records[0].vector).toEqual([0.1, 0.2, 0.3])
    expect(records[0].metadata).toEqual({ type: 'learned_pattern' })
  })

  it('upserts: deletes the previous row for the same pattern instead of duplicating it', async () => {
    vi.mocked(mockVectorStore.getById).mockResolvedValue(makeRecord(`pattern:${hashPattern('p:same')}`, 'p:same'))
    const index = new EmbeddingIndex(mockVectorStore)

    await index.storePattern('p:same', [0.9])

    expect(mockVectorStore.delete).toHaveBeenCalledWith(`pattern:${hashPattern('p:same')}`)
    expect(mockVectorStore.add).toHaveBeenCalledOnce()
  })

  it('does not delete when the pattern is new', async () => {
    vi.mocked(mockVectorStore.getById).mockResolvedValue(null)
    const index = new EmbeddingIndex(mockVectorStore)

    await index.storePattern('p:new', [0.9])

    expect(mockVectorStore.delete).not.toHaveBeenCalled()
    expect(mockVectorStore.add).toHaveBeenCalledOnce()
  })
})

describe('EmbeddingIndex.findSimilar', () => {
  it('returns matches above the threshold, highest score first', async () => {
    vi.mocked(mockVectorStore.search).mockResolvedValue([
      makeSearchResult('close match', 0.91),
      makeSearchResult('closest match', 0.97),
      makeSearchResult('exact match', 1.0),
    ])
    const index = new EmbeddingIndex(mockVectorStore, 0.85)

    const matches = await index.findSimilar([1, 0, 0])

    expect(matches.map((m) => m.pattern)).toEqual(['exact match', 'closest match', 'close match'])
    expect(mockVectorStore.search).toHaveBeenCalledWith([1, 0, 0], 5, { type: 'learned_pattern' })
  })

  it('filters out results below the threshold', async () => {
    vi.mocked(mockVectorStore.search).mockResolvedValue([
      makeSearchResult('strong', 0.95),
      makeSearchResult('weak', 0.4),
      makeSearchResult('border', 0.85),
    ])
    const index = new EmbeddingIndex(mockVectorStore, 0.85)

    const matches = await index.findSimilar([1, 0, 0])

    expect(matches.map((m) => m.pattern)).toEqual(['strong', 'border'])
  })

  it('includes a score exactly at the threshold boundary', async () => {
    vi.mocked(mockVectorStore.search).mockResolvedValue([makeSearchResult('at boundary', 0.85)])
    const index = new EmbeddingIndex(mockVectorStore, 0.85)

    const matches = await index.findSimilar([1, 0, 0])

    expect(matches).toHaveLength(1)
    expect(matches[0].score).toBe(0.85)
  })

  it('respects an explicit threshold and limit', async () => {
    vi.mocked(mockVectorStore.search).mockResolvedValue([
      makeSearchResult('a', 0.99),
      makeSearchResult('b', 0.9),
      makeSearchResult('c', 0.8),
    ])
    const index = new EmbeddingIndex(mockVectorStore, 0.85)

    const matches = await index.findSimilar([1, 0, 0], 0.95, 2)

    expect(mockVectorStore.search).toHaveBeenCalledWith([1, 0, 0], 2, { type: 'learned_pattern' })
    expect(matches).toHaveLength(1)
    expect(matches[0].pattern).toBe('a')
  })

  it('returns an empty list for an empty store', async () => {
    vi.mocked(mockVectorStore.search).mockResolvedValue([])
    const index = new EmbeddingIndex(mockVectorStore)

    const matches = await index.findSimilar([1, 0, 0])

    expect(matches).toEqual([])
  })

  it('returns an empty list when the limit is zero', async () => {
    const index = new EmbeddingIndex(mockVectorStore)

    const matches = await index.findSimilar([1, 0, 0], 0.85, 0)

    expect(matches).toEqual([])
    expect(mockVectorStore.search).not.toHaveBeenCalled()
  })
})

describe('reindexLegacyPatterns', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function ltmRow(prefix: string, outcome: unknown): VectorRecord {
    return {
      id: `${prefix}/v1:abc123`,
      vector: new Array(1536).fill(0),
      content: JSON.stringify(outcome),
      metadata: { type: 'long_term' },
      createdAt: new Date(),
    }
  }

  it('re-embeds legacy ltm rows as pattern rows and writes the version marker', async () => {
    vi.mocked(mockVectorStore.getById).mockResolvedValue(null)
    vi.mocked(mockVectorStore.getByKeyPrefix)
      .mockResolvedValueOnce([
        ltmRow('ltm:learnings', { pattern: 'learned:dev:test:fixed bug', score: 0.9, member: 'dev', skill: 'test' }),
      ])
      .mockResolvedValueOnce([
        ltmRow('ltm:antipatterns', { pattern: 'antipattern:dev:test:silent skip', score: 0.8, member: 'dev', skill: 'test' }),
      ])
    const index = new EmbeddingIndex(mockVectorStore)
    const embed = vi.fn().mockResolvedValue([1, 0, 0])

    const { reindexLegacyPatterns } = await import( '../../../src/evals/EmbeddingIndex.ts')
    const migrated = await reindexLegacyPatterns(index, mockVectorStore, embed)

    expect(migrated).toBe(2)
    expect(embed).toHaveBeenCalledTimes(2)
    expect(mockVectorStore.add).toHaveBeenCalledTimes(3)
    const [rows] = vi.mocked(mockVectorStore.add).mock.calls[2] as [VectorRecord[]]
    expect(rows[0].id).toBe(INDEX_VERSION_KEY)
    expect(rows[0].metadata).toEqual({ type: 'index_version' })
    expect(JSON.parse(rows[0].content).version).toBe(INDEX_CURRENT_VERSION)
    expect(mockVectorStore.getByKeyPrefix).toHaveBeenNthCalledWith(1, 'ltm:learnings', 10_000)
    expect(mockVectorStore.getByKeyPrefix).toHaveBeenNthCalledWith(2, 'ltm:antipatterns', 10_000)
  })

  it('skips everything when the marker is already at the current version', async () => {
    vi.mocked(mockVectorStore.getById).mockResolvedValue({
      id: INDEX_VERSION_KEY,
      vector: [],
      content: JSON.stringify({ version: 2 }),
      metadata: { type: 'index_version' },
      createdAt: new Date(),
    })
    const index = new EmbeddingIndex(mockVectorStore)
    const embed = vi.fn()

    const { reindexLegacyPatterns } = await import( '../../../src/evals/EmbeddingIndex.ts')
    const migrated = await reindexLegacyPatterns(index, mockVectorStore, embed)

    expect(migrated).toBe(0)
    expect(mockVectorStore.getByKeyPrefix).not.toHaveBeenCalled()
    expect(embed).not.toHaveBeenCalled()
    expect(mockVectorStore.add).not.toHaveBeenCalled()
  })

  it('re-runs the migration when the marker is corrupt', async () => {
    vi.mocked(mockVectorStore.getById).mockResolvedValue({
      id: INDEX_VERSION_KEY,
      vector: [],
      content: 'not-json',
      metadata: { type: 'index_version' },
      createdAt: new Date(),
    })
    vi.mocked(mockVectorStore.getByKeyPrefix).mockResolvedValue([])
    const index = new EmbeddingIndex(mockVectorStore)

    const { reindexLegacyPatterns } = await import( '../../../src/evals/EmbeddingIndex.ts')
    const migrated = await reindexLegacyPatterns(index, mockVectorStore, vi.fn())

    expect(migrated).toBe(0)
    expect(mockVectorStore.add).toHaveBeenCalledOnce()
  })

  it('skips rows with unparseable or empty content', async () => {
    vi.mocked(mockVectorStore.getById).mockResolvedValue(null)
    vi.mocked(mockVectorStore.getByKeyPrefix).mockResolvedValueOnce([
      ltmRow('ltm:learnings', 'not-json'),
      ltmRow('ltm:learnings', { score: 0.9, member: 'dev' }),
    ])
    const index = new EmbeddingIndex(mockVectorStore)
    const embed = vi.fn()

    const { reindexLegacyPatterns } = await import( '../../../src/evals/EmbeddingIndex.ts')
    const migrated = await reindexLegacyPatterns(index, mockVectorStore, embed)

    expect(migrated).toBe(0)
    expect(embed).not.toHaveBeenCalled()
    expect(mockVectorStore.add).toHaveBeenCalledOnce()
  })

  it('propagates embed failures without writing the marker', async () => {
    vi.mocked(mockVectorStore.getById).mockResolvedValue(null)
    vi.mocked(mockVectorStore.getByKeyPrefix).mockResolvedValue([
      ltmRow('ltm:learnings', { pattern: 'learned:dev:test:fixed bug', score: 0.9, member: 'dev', skill: 'test' }),
    ])
    const index = new EmbeddingIndex(mockVectorStore)
    const embed = vi.fn().mockRejectedValue(new Error('provider down'))

    const { reindexLegacyPatterns } = await import( '../../../src/evals/EmbeddingIndex.ts')
    await expect(reindexLegacyPatterns(index, mockVectorStore, embed)).rejects.toThrow('provider down')
    expect(mockVectorStore.add).not.toHaveBeenCalled()
  })
})
