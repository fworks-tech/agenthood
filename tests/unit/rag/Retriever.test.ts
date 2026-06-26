import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Retriever } from '../../../src/rag/Retriever.js'
import type { ILLMProvider } from '../../../src/llm/ILLMProvider.js'
import type { IVectorStore, VectorRecord, VectorSearchResult } from '../../../src/memory/VectorStore.js'
import type { IGraphStore } from '../../../src/rag/KnowledgeGraphStore.js'

function makeVectorRecord(overrides: Partial<VectorRecord> = {}): VectorRecord {
  return {
    id: 'doc::chunk-0',
    vector: [0.1, 0.2, 0.3],
    content: 'test content',
    metadata: { source: 'doc.md', chunkIndex: 0 },
    createdAt: new Date(),
    ...overrides,
  }
}

function makeSearchResult(overrides: Partial<VectorSearchResult> = {}): VectorSearchResult {
  return {
    record: makeVectorRecord(),
    score: 0.85,
    ...overrides,
  }
}

describe('Retriever', () => {
  let mockEmbedder: ILLMProvider
  let mockVectorStore: IVectorStore
  let retriever: Retriever

  beforeEach(() => {
    mockEmbedder = {
      embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    } as unknown as ILLMProvider

    mockVectorStore = {
      search: vi.fn(),
      add: vi.fn(),
      connect: vi.fn(),
      delete: vi.fn(),
      stats: vi.fn(),
    } as unknown as IVectorStore

    retriever = new Retriever(mockEmbedder, mockVectorStore)
  })

  it('embeds query and searches vector store', async () => {
    vi.mocked(mockVectorStore.search).mockResolvedValue([makeSearchResult()])

    const results = await retriever.retrieve('test query')

    expect(mockEmbedder.embed).toHaveBeenCalledWith('test query')
    expect(mockVectorStore.search).toHaveBeenCalled()
    expect(results).toHaveLength(1)
    expect(results[0].content).toBe('test content')
    expect(results[0].score).toBe(0.85)
  })

  it('filters results below minScore', async () => {
    vi.mocked(mockVectorStore.search).mockResolvedValue([
      makeSearchResult({ score: 0.9 }),
      makeSearchResult({ score: 0.3 }),
      makeSearchResult({ score: 0.6 }),
    ])

    const results = await retriever.retrieve('query', { minScore: 0.5 })
    expect(results).toHaveLength(2)
    expect(results[0].score).toBe(0.9)
    expect(results[1].score).toBe(0.6)
  })

  it('respects topK parameter', async () => {
    vi.mocked(mockVectorStore.search).mockImplementation(
      async (_query, topK) => [
        makeSearchResult({ score: 0.9 }),
        makeSearchResult({ score: 0.8 }),
        ...(topK && topK > 2 ? [makeSearchResult({ score: 0.7 })] : []),
      ].slice(0, topK),
    )

    const results = await retriever.retrieve('query', { topK: 2 })
    expect(results).toHaveLength(2)
  })

  it('passes metadataFilter to vector store', async () => {
    vi.mocked(mockVectorStore.search).mockResolvedValue([makeSearchResult()])

    await retriever.retrieve('query', { metadataFilter: { source: 'doc.md' } })
    expect(mockVectorStore.search).toHaveBeenCalledWith(
      [0.1, 0.2, 0.3],
      10,
      { source: 'doc.md' },
    )
  })

  it('returns empty array when no results', async () => {
    vi.mocked(mockVectorStore.search).mockResolvedValue([])
    const results = await retriever.retrieve('query')
    expect(results).toHaveLength(0)
  })

  describe('with KnowledgeGraphStore', () => {
    it('enriches results with graph context when node exists', async () => {
      const mockKGS = {
        getNode: vi.fn().mockReturnValue({
          id: 'doc::chunk-0',
          type: 'file',
          label: 'doc.md',
          metadata: { status: 'active' },
        }),
        neighbors: vi.fn().mockReturnValue([
          { node: { id: 'n2', type: 'skill', label: 'RelatedSkill', metadata: {} }, edge: {} },
        ]),
      } as unknown as IGraphStore

      vi.mocked(mockVectorStore.search).mockResolvedValue([makeSearchResult()])

      const hybridRetriever = new Retriever(mockEmbedder, mockVectorStore, mockKGS)
      const results = await hybridRetriever.retrieve('query')
      expect(results[0].graphContext).toContain('RelatedSkill')
    })

    it('handles node not in KGS gracefully', async () => {
      const mockKGS = {
        getNode: vi.fn().mockImplementation(() => { throw new Error('not found') }),
        neighbors: vi.fn(),
      } as unknown as IGraphStore

      vi.mocked(mockVectorStore.search).mockResolvedValue([makeSearchResult()])

      const hybridRetriever = new Retriever(mockEmbedder, mockVectorStore, mockKGS)
      const results = await hybridRetriever.retrieve('query')
      expect(results[0].graphContext).toBeUndefined()
    })
  })
})
