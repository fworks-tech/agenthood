import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Indexer } from '../../../src/rag/Indexer.js'
import type { ILLMProvider } from '../../../src/llm/ILLMProvider.js'
import type { IVectorStore, VectorRecord, VectorSearchResult } from '../../../src/memory/VectorStore.js'

describe('Indexer', () => {
  let mockEmbedder: ILLMProvider
  let mockVectorStore: IVectorStore
  let indexer: Indexer

  beforeEach(() => {
    mockEmbedder = {
      embed: vi.fn().mockResolvedValue(new Array(128).fill(0.1)),
    } as unknown as ILLMProvider

    mockVectorStore = {
      add: vi.fn().mockResolvedValue(undefined),
      search: vi.fn(),
      connect: vi.fn(),
      delete: vi.fn(),
      stats: vi.fn(),
    } as unknown as IVectorStore

    indexer = new Indexer({
      embedder: mockEmbedder,
      vectorStore: mockVectorStore,
      chunkSize: 200,
      chunkOverlap: 20,
    })
  })

  it('indexes a document by chunking, embedding, and storing', async () => {
    const content = 'A '.repeat(2000)
    await indexer.indexDocument('/test/file.txt', content)
    expect(mockEmbedder.embed).toHaveBeenCalled()
    expect(mockVectorStore.add).toHaveBeenCalled()
    const records = (mockVectorStore.add as ReturnType<typeof vi.fn>).mock.calls[0][0] as VectorRecord[]
    expect(records.length).toBeGreaterThan(1)
    expect(records[0].id).toContain('/test/file.txt::chunk-')
    expect(records[0].metadata).toHaveProperty('source', '/test/file.txt')
  })

  it('produces correct stats after indexing', async () => {
    await indexer.indexDocument('/test/a.md', '# Hello')
    await indexer.indexDocument('/test/b.ts', 'const x = 1')
    const stats = indexer.stats()
    expect(stats.totalDocuments).toBe(2)
    expect(stats.totalChunks).toBeGreaterThanOrEqual(2)
    expect(stats.indexedExtensions).toContain('.md')
    expect(stats.indexedExtensions).toContain('.ts')
  })

  it('returns zero stats when nothing indexed', () => {
    const stats = indexer.stats()
    expect(stats.totalDocuments).toBe(0)
    expect(stats.totalChunks).toBe(0)
    expect(stats.indexedExtensions).toEqual([])
  })

  it('handles empty content gracefully', async () => {
    await indexer.indexDocument('/test/empty.txt', '')
    expect(mockVectorStore.add).not.toHaveBeenCalled()
  })
})
