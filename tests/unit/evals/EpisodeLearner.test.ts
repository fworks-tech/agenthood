import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTestContext } from '../../helpers/testContext.ts'
import type { EvalResult, LongTermMemory } from '../../../src/core/types.ts'
import type { ExecutionContext } from '../../../src/core/ExecutionContext.ts'
import type { ResidualMemory } from '../../../src/memory/ResidualMemory.ts'
import type { IVectorStore } from '../../../src/memory/VectorStore.ts'
import { EpisodeLearner } from '../../../src/evals/EpisodeLearner.ts'
import { EmbeddingIndex } from '../../../src/evals/EmbeddingIndex.ts'
import { hashPattern } from '../../../src/utils/hash.ts'

describe('EpisodeLearner', () => {
  let mockLongTerm: LongTermMemory
  let mockResidual: ResidualMemory
  let context: ExecutionContext

  beforeEach(() => {
    mockLongTerm = {
      store: vi.fn(),
      retrieve: vi.fn(),
    }

    mockResidual = {
      record: vi.fn(),
      decay: vi.fn(),
      getActive: vi.fn().mockReturnValue([]),
      toPromptHints: vi.fn().mockReturnValue(''),
      clear: vi.fn(),
      count: vi.fn().mockReturnValue(0),
    }

    context = createTestContext({
      memory: {
        ...createTestContext().memory,
        longTerm: mockLongTerm,
        episodic: {
          record: vi.fn(),
          recall: vi.fn(),
          getEpisode: vi.fn().mockResolvedValue({
            episode: 'implemented auth middleware',
            outcome: 'success',
            timestamp: new Date().toISOString(),
          }),
        },
      },
    })
  })

  it('writes pattern to LongTermMemory under learnings/ for high scores', async () => {
    const learner = new EpisodeLearner(mockResidual)

    const evalResult: EvalResult = {
      episodeId: 'ep-1',
      scores: { faithfulness: 0.9, relevance: 0.95 },
      metadata: { member: 'architect', skill: 'write-code' },
    }

    await learner.learn(evalResult, context)

    expect(mockLongTerm.store).toHaveBeenCalledOnce()
    const [key, value] = vi.mocked(mockLongTerm.store).mock.calls[0]
    expect(key).toMatch(/^learnings\//)
    expect(value).toMatchObject({
      score: 0.925,
      member: 'architect',
      skill: 'write-code',
    })
  })

  it('reinforces ResidualMemory for high scores', async () => {
    const learner = new EpisodeLearner(mockResidual)

    const evalResult: EvalResult = {
      episodeId: 'ep-2',
      scores: { answer_correctness: 0.88 },
      metadata: { member: 'developer', skill: 'refactor' },
    }

    await learner.learn(evalResult, context)

    expect(mockResidual.record).toHaveBeenCalledOnce()
    const [pattern, strength] = vi.mocked(mockResidual.record).mock.calls[0]
    expect(pattern).toContain('learned:developer:refactor')
    expect(strength).toBe(0.88)
  })

  it('writes anti-pattern to LongTermMemory under antipatterns/ for low scores', async () => {
    const learner = new EpisodeLearner(mockResidual)

    const evalResult: EvalResult = {
      episodeId: 'ep-3',
      scores: { faithfulness: 0.35, relevance: 0.3 },
      metadata: { member: 'qa', skill: 'test' },
    }

    await learner.learn(evalResult, context)

    expect(mockLongTerm.store).toHaveBeenCalledOnce()
    const [key, value] = vi.mocked(mockLongTerm.store).mock.calls[0]
    expect(key).toMatch(/^antipatterns\//)
    expect(value).toMatchObject({
      member: 'qa',
      skill: 'test',
    })
  })

  it('decays ResidualMemory signal for low scores', async () => {
    const learner = new EpisodeLearner(mockResidual)

    const evalResult: EvalResult = {
      episodeId: 'ep-4',
      scores: { relevance: 0.25 },
      metadata: { member: 'developer', skill: 'write-code' },
    }

    await learner.learn(evalResult, context)

    expect(mockResidual.record).toHaveBeenCalledOnce()
    const [pattern, strength] = vi.mocked(mockResidual.record).mock.calls[0]
    expect(pattern).toContain('antipattern:developer:write-code')
    expect(strength).toBe(-0.25)
  })

  it('does nothing for mid-range scores', async () => {
    const learner = new EpisodeLearner(mockResidual)

    const evalResult: EvalResult = {
      episodeId: 'ep-5',
      scores: { faithfulness: 0.6 },
      metadata: { member: 'architect', skill: 'design' },
    }

    await learner.learn(evalResult, context)

    expect(mockLongTerm.store).not.toHaveBeenCalled()
    expect(mockResidual.record).not.toHaveBeenCalled()
  })

  it('does nothing when scores object is empty', async () => {
    const learner = new EpisodeLearner(mockResidual)

    const evalResult: EvalResult = {
      episodeId: 'ep-6',
      scores: {},
    }

    await learner.learn(evalResult, context)

    expect(mockLongTerm.store).not.toHaveBeenCalled()
    expect(mockResidual.record).not.toHaveBeenCalled()
  })

  it('does nothing when episode is not found', async () => {
    const learner = new EpisodeLearner(mockResidual)

    context = createTestContext({
      memory: {
        ...createTestContext().memory,
        longTerm: mockLongTerm,
        episodic: {
          record: vi.fn(),
          recall: vi.fn(),
          getEpisode: vi.fn().mockResolvedValue(null),
        },
      },
    })

    const evalResult: EvalResult = {
      episodeId: 'nonexistent',
      scores: { faithfulness: 0.95 },
    }

    await learner.learn(evalResult, context)

    expect(mockLongTerm.store).not.toHaveBeenCalled()
    expect(mockResidual.record).not.toHaveBeenCalled()
  })

  it('is idempotent — calling learn() twice with same args does not error', async () => {
    const learner = new EpisodeLearner(mockResidual)

    const evalResult: EvalResult = {
      episodeId: 'ep-7',
      scores: { faithfulness: 0.92 },
      metadata: { member: 'reviewer', skill: 'review' },
    }

    await learner.learn(evalResult, context)
    await learner.learn(evalResult, context)

    expect(mockLongTerm.store).toHaveBeenCalledTimes(2)
    expect(mockResidual.record).toHaveBeenCalledTimes(2)
  })

  it('works without ResidualMemory', async () => {
    const learner = new EpisodeLearner()

    const evalResult: EvalResult = {
      episodeId: 'ep-8',
      scores: { faithfulness: 0.95 },
    }

    await expect(learner.learn(evalResult, context)).resolves.toBeUndefined()
    expect(mockLongTerm.store).toHaveBeenCalledOnce()
  })

  it('uses existing pattern key when the index finds a semantic match', async () => {
    const mockVecStore: IVectorStore = {
      connect: vi.fn(),
      add: vi.fn(),
      search: vi.fn().mockResolvedValue([{
        record: {
          id: 'pattern:existing',
          vector: [1, 0, 0],
          content: 'learned:architect:write-code:implemented auth middleware',
          metadata: { type: 'learned_pattern' },
          createdAt: new Date(),
        },
        score: 0.9,
      }]),
      delete: vi.fn(),
      stats: vi.fn(),
      getById: vi.fn(),
      getByKeyPrefix: vi.fn(),
    }

    const index = new EmbeddingIndex(mockVecStore, 0.85)

    const learner = new EpisodeLearner(mockResidual, index)

    context = createTestContext({
      memory: {
        ...createTestContext().memory,
        longTerm: mockLongTerm,
        episodic: {
          record: vi.fn(),
          recall: vi.fn(),
          getEpisode: vi.fn().mockResolvedValue({
            episode: 'implemented auth middleware',
            outcome: 'success',
            timestamp: new Date().toISOString(),
          }),
        },
      },
    })

    const evalResult: EvalResult = {
      episodeId: 'ep-semantic-1',
      scores: { faithfulness: 0.95 },
      metadata: { member: 'architect', skill: 'write-code' },
    }

    await learner.learn(evalResult, context)

    expect(mockLongTerm.store).toHaveBeenCalledOnce()
    const [key] = vi.mocked(mockLongTerm.store).mock.calls[0]
    expect(key).toBe(`learnings/${hashPattern('learned:architect:write-code:implemented auth middleware')}`)
  })

  it('falls back to hash-based matching and adds the pattern when the index finds no match', async () => {
    const mockVecStore: IVectorStore = {
      connect: vi.fn(),
      add: vi.fn(),
      search: vi.fn().mockResolvedValue([]),
      delete: vi.fn(),
      stats: vi.fn(),
      getById: vi.fn(),
      getByKeyPrefix: vi.fn(),
    }

    const index = new EmbeddingIndex(mockVecStore, 0.85)

    const learner = new EpisodeLearner(mockResidual, index)

    const evalResult: EvalResult = {
      episodeId: 'ep-semantic-2',
      scores: { relevance: 0.92 },
      metadata: { member: 'developer', skill: 'test' },
    }

    await learner.learn(evalResult, context)

    expect(mockLongTerm.store).toHaveBeenCalledOnce()
    expect(mockVecStore.add).toHaveBeenCalledOnce()
  })

  it('degrades to the hash fallback when embedding is unavailable', async () => {
    const mockVecStore: IVectorStore = {
      connect: vi.fn(),
      add: vi.fn(),
      search: vi.fn(),
      delete: vi.fn(),
      stats: vi.fn(),
      getById: vi.fn(),
      getByKeyPrefix: vi.fn(),
    }

    const index = new EmbeddingIndex(mockVecStore, 0.85)
    const learner = new EpisodeLearner(mockResidual, index)

    context = createTestContext({
      llm: {
        complete: vi.fn(),
        stream: vi.fn(),
        embed: vi.fn().mockRejectedValue(new Error('embedding unsupported')),
        setModel: vi.fn(),
        generate: vi.fn(),
      },
      memory: {
        ...createTestContext().memory,
        longTerm: mockLongTerm,
        episodic: {
          record: vi.fn(),
          recall: vi.fn(),
          getEpisode: vi.fn().mockResolvedValue({
            episode: 'brand new episode topic',
            outcome: 'success',
            timestamp: new Date().toISOString(),
          }),
        },
      },
    })

    const evalResult: EvalResult = {
      episodeId: 'ep-degraded',
      scores: { relevance: 0.92 },
      metadata: { member: 'developer', skill: 'test' },
    }

    await learner.learn(evalResult, context)

    expect(mockVecStore.add).not.toHaveBeenCalled()
    expect(mockLongTerm.store).toHaveBeenCalledOnce()
    const [key] = vi.mocked(mockLongTerm.store).mock.calls[0]
    expect(key).toMatch(/^learnings\//)
  })
})

describe('EpisodeLearner status', () => {
  let mockLongTerm: LongTermMemory
  let context: ExecutionContext

  beforeEach(() => {
    mockLongTerm = {
      store: vi.fn(),
      retrieve: vi.fn(),
    }
    context = createTestContext({
      memory: {
        ...createTestContext().memory,
        longTerm: mockLongTerm,
        episodic: {
          record: vi.fn(),
          recall: vi.fn(),
          getEpisode: vi.fn().mockResolvedValue({
            episode: 'episode text',
            outcome: 'success',
            timestamp: new Date().toISOString(),
          }),
        },
      },
    })
  })

  it('shows zero values before any learn() call', async () => {
    const learner = new EpisodeLearner()
    expect(learner.getStatus()).toEqual({
      lastUpdate: null,
      highScoreCount: 0,
      midScoreCount: 0,
      lowScoreCount: 0,
      totalEpisodes: 0,
      confidenceTrend: 'stable',
      memberBreakdown: {},
    })
  })

  it('counts bands and members across learn() calls', async () => {
    const learner = new EpisodeLearner()

    await learner.learn({ episodeId: 'a', scores: { x: 0.9 }, metadata: { member: 'the-scribe' } }, context)
    await learner.learn({ episodeId: 'b', scores: { x: 0.85 }, metadata: { member: 'the-scribe' } }, context)
    await learner.learn({ episodeId: 'c', scores: { x: 0.95 }, metadata: { member: 'the-reviewer' } }, context)
    await learner.learn({ episodeId: 'd', scores: { x: 0.3 }, metadata: { member: 'the-scribe' } }, context)
    await learner.learn({ episodeId: 'e', scores: { x: 0.2 }, metadata: { member: 'the-reviewer' } }, context)

    const status = learner.getStatus()
    expect(status.totalEpisodes).toBe(5)
    expect(status.highScoreCount).toBe(3)
    expect(status.lowScoreCount).toBe(2)
    expect(status.midScoreCount).toBe(0)
    expect(status.lastUpdate).toBeTruthy()
    expect(status.memberBreakdown['the-scribe']).toEqual({ learned: 2, antipatterns: 1 })
    expect(status.memberBreakdown['the-reviewer']).toEqual({ learned: 1, antipatterns: 1 })
  })

  it('counts mid-band episodes separately', async () => {
    const learner = new EpisodeLearner()
    await learner.learn({ episodeId: 'm', scores: { x: 0.6 }, metadata: { member: 'the-scribe' } }, context)
    expect(learner.getStatus().midScoreCount).toBe(1)
    expect(learner.getStatus().lowScoreCount).toBe(0)
  })

  it('reports a rising confidence trend for improving scores', async () => {
    const learner = new EpisodeLearner()
    for (const score of [0.4, 0.45, 0.8, 0.85, 0.9, 0.95]) {
      await learner.learn({ episodeId: String(score), scores: { x: score }, metadata: { member: 'the-scribe' } }, context)
    }
    expect(learner.getStatus().confidenceTrend).toBe('rising')
  })

  it('reports a falling confidence trend for degrading scores', async () => {
    const learner = new EpisodeLearner()
    for (const score of [0.9, 0.85, 0.4, 0.35, 0.3, 0.25]) {
      await learner.learn({ episodeId: String(score), scores: { x: score }, metadata: { member: 'the-scribe' } }, context)
    }
    expect(learner.getStatus().confidenceTrend).toBe('falling')
  })

  it('does not count episodes with empty scores', async () => {
    const learner = new EpisodeLearner()
    await learner.learn({ episodeId: 'empty', scores: {}, metadata: { member: 'the-scribe' } }, context)
    expect(learner.getStatus().totalEpisodes).toBe(0)
  })
})
