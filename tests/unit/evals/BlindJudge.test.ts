import { describe, it, expect, vi } from 'vitest'
import { BlindJudge } from '../../../src/evals/BlindJudge.ts'
import type { EvalJudge } from '../../../src/evals/EvalJudge.ts'

function createMockJudge(scores: Record<string, number>): EvalJudge {
  return {
    score: vi.fn(async (_metric: string, _ctx: { output: string }) => {
      return scores[_ctx.output] ?? null
    }),
  }
}

describe('BlindJudge', () => {
  it('scores both outputs independently', async () => {
    const judge = createMockJudge({ alpha: 0.8, beta: 0.6 })
    const blindJudge = new BlindJudge(judge)
    const result = await blindJudge.compareTask('input', 'expected', 'alpha', 'beta', ['clarity'])
    expect(result.scoresA.clarity).toBe(0.8)
    expect(result.scoresB.clarity).toBe(0.6)
  })

  it('computes deltas as B - A', async () => {
    const judge = createMockJudge({ a: 0.7, b: 0.9 })
    const blindJudge = new BlindJudge(judge)
    const result = await blindJudge.compareTask('input', 'expected', 'a', 'b', ['clarity'])
    expect(result.deltas.clarity).toBeCloseTo(0.2, 4)
  })

  it('handles multiple metrics', async () => {
    const judge = createMockJudge({ a: 0.8, b: 0.6 })
    const blindJudge = new BlindJudge(judge)
    const result = await blindJudge.compareTask('input', 'expected', 'a', 'b', ['clarity', 'completeness', 'accuracy'])
    expect(Object.keys(result.scoresA)).toHaveLength(3)
    expect(Object.keys(result.scoresB)).toHaveLength(3)
    expect(Object.keys(result.deltas)).toHaveLength(3)
  })

  it('skips delta when a score is null', async () => {
    const judge: EvalJudge = {
      score: vi.fn(async (_metric: string, ctx: { output: string }) => {
        return ctx.output === 'a' ? null : 0.7
      }),
    }
    const blindJudge = new BlindJudge(judge)
    const result = await blindJudge.compareTask('input', 'expected', 'a', 'b', ['clarity'])
    expect(result.scoresA.clarity).toBeUndefined()
    expect(result.scoresB.clarity).toBe(0.7)
    expect(result.deltas.clarity).toBeUndefined()
  })
})
