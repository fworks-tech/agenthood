import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { IVectorStore, VectorRecord } from '../../../src/memory/VectorStore.js'
import type { ILLMProvider } from '../../../src/llm/ILLMProvider.js'
import type { LearningOutcome } from '../../../src/evals/EpisodeLearner.js'

const mockVectorStore: IVectorStore = {
  connect: vi.fn(),
  add: vi.fn(),
  search: vi.fn(),
  delete: vi.fn(),
  stats: vi.fn(),
  getById: vi.fn(),
  getByKeyPrefix: vi.fn(),
}

const mockEmbedder: ILLMProvider = {
  generate: vi.fn(),
  embed: vi.fn(),
  setModel: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
})

function makePatternRecord(overrides: Partial<VectorRecord> = {}): VectorRecord {
  return {
    id: 'pattern:abc123',
    vector: [],
    content: JSON.stringify({
      pattern: 'learned:architect:write-code:implemented auth middleware',
      score: 0.925,
      member: 'architect',
      skill: 'write-code',
    } as LearningOutcome),
    metadata: { type: 'learned_pattern' },
    createdAt: new Date(),
    ...overrides,
  }
}

describe('SemanticPatternMatcher', () => {
  it('returns null from match when pattern list is empty', async () => {
    vi.mocked(mockVectorStore.getByKeyPrefix).mockResolvedValue([])
    const { SemanticPatternMatcher } = await import('../../../src/evals/SemanticPatternMatcher.js')
    const matcher = new SemanticPatternMatcher(mockVectorStore)
    await matcher.initialize()

    vi.mocked(mockEmbedder.embed).mockResolvedValue([1, 0, 0])
    const result = await matcher.match('some episode text', mockEmbedder)
    expect(result).toBeNull()
  })

  it('returns a match with 0.95+ similarity for near-identical patterns', async () => {
    const identicalVec = [1, 0, 0]
    vi.mocked(mockVectorStore.getByKeyPrefix).mockResolvedValue([
      makePatternRecord({ vector: identicalVec }),
    ])
    const { SemanticPatternMatcher } = await import('../../../src/evals/SemanticPatternMatcher.js')
    const matcher = new SemanticPatternMatcher(mockVectorStore, 0.85)
    await matcher.initialize()

    vi.mocked(mockEmbedder.embed).mockResolvedValue(identicalVec)
    const result = await matcher.match('implemented auth middleware', mockEmbedder)
    expect(result).not.toBeNull()
    expect(result!.score).toBeGreaterThanOrEqual(0.95)
  })

  it('returns <0.5 similarity for dissimilar patterns', async () => {
    vi.mocked(mockVectorStore.getByKeyPrefix).mockResolvedValue([
      makePatternRecord({ vector: [1, 0, 0] }),
    ])
    const { SemanticPatternMatcher } = await import('../../../src/evals/SemanticPatternMatcher.js')
    const matcher = new SemanticPatternMatcher(mockVectorStore, 0.85)
    await matcher.initialize()

    vi.mocked(mockEmbedder.embed).mockResolvedValue([0, 1, 0])
    const result = await matcher.match('completely unrelated topic', mockEmbedder)
    expect(result).toBeNull()
  })

  it('returns the best match when multiple patterns exist', async () => {
    vi.mocked(mockVectorStore.getByKeyPrefix).mockResolvedValue([
      makePatternRecord({
        id: 'pattern:far',
        vector: [0, 1, 0],
        content: JSON.stringify({ pattern: 'far match', score: 0.9, member: 'a', skill: 'b' } as LearningOutcome),
      }),
      makePatternRecord({
        id: 'pattern:close',
        vector: [0.95, 0.05, 0],
        content: JSON.stringify({ pattern: 'close match', score: 0.92, member: 'a', skill: 'b' } as LearningOutcome),
      }),
    ])
    const { SemanticPatternMatcher } = await import('../../../src/evals/SemanticPatternMatcher.js')
    const matcher = new SemanticPatternMatcher(mockVectorStore, 0.85)
    await matcher.initialize()

    vi.mocked(mockEmbedder.embed).mockResolvedValue([0.95, 0.05, 0])
    const result = await matcher.match('some episode', mockEmbedder)
    expect(result).not.toBeNull()
    expect(result!.outcome.pattern).toBe('close match')
  })

  it('addPattern stores the pattern in the vector store', async () => {
    vi.mocked(mockVectorStore.getByKeyPrefix).mockResolvedValue([])
    const { SemanticPatternMatcher } = await import('../../../src/evals/SemanticPatternMatcher.js')
    const matcher = new SemanticPatternMatcher(mockVectorStore, 0.85)
    await matcher.initialize()

    vi.mocked(mockEmbedder.embed).mockResolvedValue([0.5, 0.5, 0])
    const outcome: LearningOutcome = { pattern: 'learned:dev:test:fixed bug', score: 0.9, member: 'dev', skill: 'test' }
    await matcher.addPattern(outcome, mockEmbedder)

    expect(mockVectorStore.add).toHaveBeenCalledOnce()
    const [records] = vi.mocked(mockVectorStore.add).mock.calls[0] as [VectorRecord[]]
    expect(records[0].id).toMatch(/^pattern:/)
    expect(JSON.parse(records[0].content)).toMatchObject({ member: 'dev', skill: 'test' })
  })

  it('initialize loads existing patterns from vector store', async () => {
    vi.mocked(mockVectorStore.getByKeyPrefix).mockResolvedValue([
      makePatternRecord({ vector: [1, 0, 0] }),
    ])
    const { SemanticPatternMatcher } = await import('../../../src/evals/SemanticPatternMatcher.js')
    const matcher = new SemanticPatternMatcher(mockVectorStore, 0.85)
    await matcher.initialize()

    vi.mocked(mockEmbedder.embed).mockResolvedValue([1, 0, 0])
    const result = await matcher.match('implemented auth middleware', mockEmbedder)
    expect(result).not.toBeNull()
  })

  it('returns a match at the exact boundary threshold', async () => {
    vi.mocked(mockVectorStore.getByKeyPrefix).mockResolvedValue([
      makePatternRecord({ vector: [1, 0, 0] }),
    ])
    const { SemanticPatternMatcher } = await import('../../../src/evals/SemanticPatternMatcher.js')
    const matcher = new SemanticPatternMatcher(mockVectorStore, 0.85)
    await matcher.initialize()

    vi.mocked(mockEmbedder.embed).mockResolvedValue([0.85, Math.sqrt(1 - 0.85 * 0.85), 0])
    const result = await matcher.match('similar text', mockEmbedder)
    expect(result).not.toBeNull()
    expect(result!.score).toBeCloseTo(0.85, 2)
  })

  it('returns null when score is just below threshold', async () => {
    vi.mocked(mockVectorStore.getByKeyPrefix).mockResolvedValue([
      makePatternRecord({ vector: [1, 0, 0] }),
    ])
    const { SemanticPatternMatcher } = await import('../../../src/evals/SemanticPatternMatcher.js')
    const matcher = new SemanticPatternMatcher(mockVectorStore, 0.85)
    await matcher.initialize()

    vi.mocked(mockEmbedder.embed).mockResolvedValue([0.84, Math.sqrt(1 - 0.84 * 0.84), 0])
    const result = await matcher.match('slightly different text', mockEmbedder)
    expect(result).toBeNull()
  })

  it('retries embedder on failure then throws', async () => {
    vi.mocked(mockVectorStore.getByKeyPrefix).mockResolvedValue([])
    const { SemanticPatternMatcher } = await import('../../../src/evals/SemanticPatternMatcher.js')
    const matcher = new SemanticPatternMatcher(mockVectorStore, 0.85)
    await matcher.initialize()

    const embedSpy = vi.mocked(mockEmbedder.embed)
    embedSpy.mockRejectedValue(new Error('network error'))
    await expect(matcher.match('any text', mockEmbedder)).rejects.toThrow('network error')
    expect(embedSpy).toHaveBeenCalledTimes(2)
  })

  it('retries embedder on failure in addPattern then throws', async () => {
    vi.mocked(mockVectorStore.getByKeyPrefix).mockResolvedValue([])
    const { SemanticPatternMatcher } = await import('../../../src/evals/SemanticPatternMatcher.js')
    const matcher = new SemanticPatternMatcher(mockVectorStore, 0.85)
    await matcher.initialize()

    const embedSpy = vi.mocked(mockEmbedder.embed)
    embedSpy.mockRejectedValue(new Error('timeout'))
    const outcome: LearningOutcome = { pattern: 'test:pattern', score: 0.9, member: 'dev', skill: 'test' }
    await expect(matcher.addPattern(outcome, mockEmbedder)).rejects.toThrow('timeout')
    expect(embedSpy).toHaveBeenCalledTimes(2)
  })
})
