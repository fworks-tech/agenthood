import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTestContext } from '../../helpers/testContext.ts'
import type { EvalResult, LongTermMemory } from '../../../src/core/types.ts'
import type { ExecutionContext } from '../../../src/core/ExecutionContext.ts'
import type { ResidualMemory } from '../../../src/memory/ResidualMemory.ts'

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
    const { EpisodeLearner } = await import('../../../src/evals/EpisodeLearner.js')
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
    const { EpisodeLearner } = await import('../../../src/evals/EpisodeLearner.js')
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
    const { EpisodeLearner } = await import('../../../src/evals/EpisodeLearner.js')
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
    const { EpisodeLearner } = await import('../../../src/evals/EpisodeLearner.js')
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
    const { EpisodeLearner } = await import('../../../src/evals/EpisodeLearner.js')
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
    const { EpisodeLearner } = await import('../../../src/evals/EpisodeLearner.js')
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
    const { EpisodeLearner } = await import('../../../src/evals/EpisodeLearner.js')
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
    const { EpisodeLearner } = await import('../../../src/evals/EpisodeLearner.js')
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
    const { EpisodeLearner } = await import('../../../src/evals/EpisodeLearner.js')
    const learner = new EpisodeLearner()

    const evalResult: EvalResult = {
      episodeId: 'ep-8',
      scores: { faithfulness: 0.95 },
    }

    await expect(learner.learn(evalResult, context)).resolves.toBeUndefined()
    expect(mockLongTerm.store).toHaveBeenCalledOnce()
  })
})
