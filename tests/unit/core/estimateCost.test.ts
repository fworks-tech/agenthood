import { describe, it, expect, vi, afterEach } from 'vitest'
import { estimateCost } from '../../../src/core/modelPricing.ts'

describe('estimateCost', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns correct cost for known models', () => {
    const estimate = estimateCost('gpt-4o', 1_000_000, 1_000_000)
    expect(estimate.estimatedCost).toBe(12.5)
    expect(estimate.currency).toBe('USD')
    expect(estimate.model).toBe('gpt-4o')
    expect(estimate.inputTokens).toBe(1_000_000)
    expect(estimate.outputTokens).toBe(1_000_000)
  })

  it('returns correct cost for opencode go models without warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(estimateCost('mimo-v2.5', 1_000_000, 1_000_000).estimatedCost).toBe(0.42)
    expect(warn).not.toHaveBeenCalled()
  })

  it('returns fallback cost with warning for unknown models', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const estimate = estimateCost('mystery-model-a', 1_000_000, 1_000_000)
    expect(estimate.estimatedCost).toBe(4)
    expect(warn).toHaveBeenCalledOnce()
    expect(warn.mock.calls[0][0]).toContain('mystery-model-a')
  })

  it('warns only once per unknown model', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    estimateCost('mystery-model-b', 1, 1)
    estimateCost('mystery-model-b', 1, 1)
    expect(warn).toHaveBeenCalledOnce()
  })

  it('returns zero cost for zero tokens', () => {
    expect(estimateCost('gpt-4o', 0, 0).estimatedCost).toBe(0)
  })

  it('returns partial cost for output-only calls', () => {
    expect(estimateCost('gpt-4o', 0, 1_000_000).estimatedCost).toBe(10)
  })

  it('rounds to 4 decimal places', () => {
    // gpt-4: $30/1M in → 123 tokens = 0.00369, 7 tokens out = 0.00042
    const estimate = estimateCost('gpt-4', 123, 7)
    expect(estimate.estimatedCost).toBeCloseTo(0.00411, 4)
    expect(String(estimate.estimatedCost)).not.toMatch(/0{5,}\d$/)
  })
})
