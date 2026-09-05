import { describe, it, expect, vi, afterEach } from 'vitest'
import { CostEstimator } from '../../../src/core/CostEstimator.ts'

describe('CostEstimator', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns correct cost for known models', () => {
    const estimator = new CostEstimator()
    const estimate = estimator.computeCost('gpt-4o', 1_000_000, 1_000_000)
    expect(estimate.estimatedCost).toBe(12.5)
    expect(estimate.currency).toBe('USD')
    expect(estimate.model).toBe('gpt-4o')
    expect(estimate.inputTokens).toBe(1_000_000)
    expect(estimate.outputTokens).toBe(1_000_000)
  })

  it('returns correct cost for opencode go models without warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const estimator = new CostEstimator()
    expect(estimator.computeCost('mimo-v2.5', 1_000_000, 1_000_000).estimatedCost).toBe(0.42)
    expect(warn).not.toHaveBeenCalled()
  })

  it('returns fallback cost with warning for unknown models', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const estimator = new CostEstimator()
    const estimate = estimator.computeCost('mystery-model', 1_000_000, 1_000_000)
    expect(estimate.estimatedCost).toBe(4)
    expect(warn).toHaveBeenCalledOnce()
    expect(warn.mock.calls[0][0]).toContain('mystery-model')
  })

  it('warns only once per unknown model', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const estimator = new CostEstimator()
    estimator.computeCost('mystery-model', 1, 1)
    estimator.computeCost('mystery-model', 1, 1)
    expect(warn).toHaveBeenCalledOnce()
  })

  it('returns zero cost for zero tokens', () => {
    const estimator = new CostEstimator()
    expect(estimator.computeCost('gpt-4o', 0, 0).estimatedCost).toBe(0)
  })

  it('returns partial cost for output-only calls', () => {
    const estimator = new CostEstimator()
    expect(estimator.computeCost('gpt-4o', 0, 1_000_000).estimatedCost).toBe(10)
  })

  it('rounds to 4 decimal places', () => {
    const estimator = new CostEstimator()
    // gpt-4: $30/1M in → 123 tokens = 0.00369, 7 tokens out = 0.00042
    const estimate = estimator.computeCost('gpt-4', 123, 7)
    expect(estimate.estimatedCost).toBeCloseTo(0.00411, 4)
    expect(String(estimate.estimatedCost)).not.toMatch(/0{5,}\d$/)
  })
})
