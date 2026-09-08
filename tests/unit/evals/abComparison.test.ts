import { describe, it, expect } from 'vitest'
import {
  mean, sampleStdDev, pairedTTest, cohensD, effectLabel,
  aggregateABScores, determineWinner, computeSignificance,
} from '../../../src/evals/abComparison.ts'
import type { ABTaskScore } from '../../../src/evals/types.ts'

function abTask(over: Partial<ABTaskScore>): ABTaskScore {
  return {
    input: 'test', expectedOutput: 'expected', outputA: 'a', outputB: 'b',
    scoresA: { clarity: 0.8, completeness: 0.7, accuracy: 0.9 },
    scoresB: { clarity: 0.6, completeness: 0.8, accuracy: 0.7 },
    deltas: { clarity: -0.2, completeness: 0.1, accuracy: -0.2 },
    ...over,
  }
}

describe('mean', () => {
  it('returns 0 for empty array', () => {
    expect(mean([])).toBe(0)
  })

  it('computes arithmetic mean', () => {
    expect(mean([0.5, 0.7, 0.9])).toBeCloseTo(0.7, 4)
  })
})

describe('sampleStdDev', () => {
  it('returns 0 for fewer than 2 values', () => {
    expect(sampleStdDev([])).toBe(0)
    expect(sampleStdDev([0.5])).toBe(0)
  })

  it('computes sample standard deviation', () => {
    expect(sampleStdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 2)
  })
})

describe('pairedTTest', () => {
  it('returns p=1 for fewer than 2 differences', () => {
    expect(pairedTTest([]).pValue).toBe(1)
    expect(pairedTTest([0.5]).pValue).toBe(1)
  })

  it('detects significant difference', () => {
    const result = pairedTTest([0.1, 0.12, 0.11, 0.09, 0.13])
    expect(result.pValue).toBeLessThan(0.05)
    expect(result.tStatistic).toBeGreaterThan(0)
    expect(result.df).toBe(4)
  })

  it('no significance for noisy differences', () => {
    const result = pairedTTest([0.5, -0.5, 0.3, -0.3, 0.1])
    expect(result.pValue).toBeGreaterThan(0.05)
  })
})

describe('cohensD', () => {
  it('returns 0 for fewer than 2 values', () => {
    expect(cohensD([])).toBe(0)
  })

  it('computes effect size', () => {
    const d = cohensD([0.1, 0.2, 0.3, 0.4])
    expect(d).toBeGreaterThan(0)
  })

  it('returns 0 when variance is zero', () => {
    expect(cohensD([0.2, 0.2, 0.2, 0.2])).toBe(0)
  })
})

describe('effectLabel', () => {
  it('classifies effect sizes', () => {
    expect(effectLabel(0.1)).toBe('negligible')
    expect(effectLabel(0.3)).toBe('small')
    expect(effectLabel(0.6)).toBe('medium')
    expect(effectLabel(0.9)).toBe('large')
  })
})

describe('aggregateABScores', () => {
  it('computes per-metric means', () => {
    const tasks = [
      abTask({
        scoresA: { clarity: 0.8, completeness: 0.7, accuracy: 0.9 },
        scoresB: { clarity: 0.6, completeness: 0.8, accuracy: 0.7 },
      }),
      abTask({
        scoresA: { clarity: 0.6, completeness: 0.9, accuracy: 0.8 },
        scoresB: { clarity: 0.8, completeness: 0.7, accuracy: 0.9 },
      }),
    ]
    const { aggregateA, aggregateB } = aggregateABScores(tasks, ['clarity', 'completeness', 'accuracy'])
    expect(aggregateA.clarity).toBeCloseTo(0.7, 4)
    expect(aggregateB.clarity).toBeCloseTo(0.7, 4)
    expect(aggregateA.completeness).toBeCloseTo(0.8, 4)
  })
})

describe('determineWinner', () => {
  it('A wins when A leads on more metrics', () => {
    expect(determineWinner(
      { clarity: 0.9, completeness: 0.8 },
      { clarity: 0.7, completeness: 0.6 },
      ['clarity', 'completeness'],
    )).toBe('A')
  })

  it('B wins when B leads on more metrics', () => {
    expect(determineWinner(
      { clarity: 0.6, completeness: 0.7 },
      { clarity: 0.8, completeness: 0.9 },
      ['clarity', 'completeness'],
    )).toBe('B')
  })

  it('tie when equal', () => {
    expect(determineWinner(
      { clarity: 0.8, completeness: 0.7 },
      { clarity: 0.7, completeness: 0.8 },
      ['clarity', 'completeness'],
    )).toBe('tie')
  })
})

describe('computeSignificance', () => {
  it('returns full significance result', () => {
    const result = computeSignificance([0.1, 0.12, 0.11, 0.09, 0.13])
    expect(result).toHaveProperty('tStatistic')
    expect(result).toHaveProperty('pValue')
    expect(result).toHaveProperty('df')
    expect(result).toHaveProperty('significant')
    expect(result).toHaveProperty('effectSize')
    expect(result).toHaveProperty('effectLabel')
  })
})
