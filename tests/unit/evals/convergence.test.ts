import { describe, it, expect } from 'vitest'
import { detectConvergence, detectRegression, computeVariance, DEFAULT_CONVERGENCE, DEFAULT_REGRESSION_THRESHOLD } from '../../../src/evals/convergence.ts'
import type { EvalRunRecord } from '../../../src/evals/types.ts'

function run(over: Partial<EvalRunRecord>): EvalRunRecord {
  return {
    version: '0.0.0', timestamp: '2025-01-01T00:00:00.000Z', member: 'm', suiteName: 's',
    passRate: 0.8, aggregate: { relevance: 0.8 }, taskCount: 5, durationMs: 1000, ...over,
  }
}

describe('computeVariance', () => {
  it('returns 0 for fewer than 2 values', () => {
    expect(computeVariance([])).toBe(0)
    expect(computeVariance([0.5])).toBe(0)
  })

  it('computes population variance', () => {
    expect(computeVariance([0.5, 0.5, 0.5])).toBe(0)
    expect(computeVariance([0.4, 0.6, 0.5])).toBeCloseTo(0.006667, 4)
  })
})

describe('detectConvergence', () => {
  it('not converged when fewer than minRuns', () => {
    const history = [run({ passRate: 0.8 }), run({ passRate: 0.8 })]
    const result = detectConvergence(history)
    expect(result.converged).toBe(false)
    expect(result.runsObserved).toBe(2)
  })

  it('converged when variance below threshold over minRuns', () => {
    const history = [
      run({ passRate: 0.80 }),
      run({ passRate: 0.81 }),
      run({ passRate: 0.79 }),
    ]
    const result = detectConvergence(history)
    expect(result.converged).toBe(true)
    expect(result.variance).toBeLessThan(DEFAULT_CONVERGENCE.threshold)
  })

  it('not converged when variance exceeds threshold', () => {
    const history = [
      run({ passRate: 0.9 }),
      run({ passRate: 0.5 }),
      run({ passRate: 0.85 }),
    ]
    const result = detectConvergence(history)
    expect(result.converged).toBe(false)
  })

  it('uses only the last windowSize runs', () => {
    const history = [
      run({ passRate: 0.1 }),
      run({ passRate: 0.2 }),
      run({ passRate: 0.80 }),
      run({ passRate: 0.81 }),
      run({ passRate: 0.79 }),
    ]
    const result = detectConvergence(history, { ...DEFAULT_CONVERGENCE, windowSize: 3 })
    expect(result.converged).toBe(true)
    expect(result.runsObserved).toBe(3)
  })

  it('empty history is not converged', () => {
    const result = detectConvergence([])
    expect(result.converged).toBe(false)
    expect(result.meanPassRate).toBe(0)
  })
})

describe('detectRegression', () => {
  it('no regression on empty history', () => {
    const result = detectRegression([])
    expect(result.isRegression).toBe(false)
  })

  it('no regression when latest equals best', () => {
    const history = [run({ passRate: 0.8 }), run({ passRate: 0.8 })]
    const result = detectRegression(history)
    expect(result.isRegression).toBe(false)
    expect(result.delta).toBe(0)
  })

  it('regression when current drops more than threshold below best', () => {
    const history = [run({ passRate: 0.9 }), run({ passRate: 0.75 })]
    const result = detectRegression(history)
    expect(result.isRegression).toBe(true)
    expect(result.delta).toBeCloseTo(0.15, 4)
  })

  it('no regression when drop is within threshold', () => {
    const history = [run({ passRate: 0.9 }), run({ passRate: 0.85 })]
    const result = detectRegression(history, 0.1)
    expect(result.isRegression).toBe(false)
  })

  it('respects custom threshold', () => {
    const history = [run({ passRate: 0.9 }), run({ passRate: 0.82 })]
    expect(detectRegression(history, 0.05).isRegression).toBe(true)
    expect(detectRegression(history, 0.2).isRegression).toBe(false)
  })

  it('default regression threshold is 0.1', () => {
    expect(DEFAULT_REGRESSION_THRESHOLD).toBe(0.1)
  })
})
