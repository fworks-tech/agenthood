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

  it('returns correct cost for opencode models from the catalog without warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(estimateCost('glm-5.3-flash', 1_000_000, 1_000_000, 'opencode').estimatedCost).toBe(0.65)
    expect(estimateCost('opencode/gpt-5-nano', 1_000_000, 1_000_000, 'opencode-go').estimatedCost).toBe(0.45)
    expect(warn).not.toHaveBeenCalled()
  })

  it('prices opencode models by the context tier the prompt falls into', () => {
    expect(estimateCost('claude-haiku-5-5', 50_000, 0, 'opencode').estimatedCost).toBe(0.005)
    expect(estimateCost('claude-haiku-5-5', 150_000, 0, 'opencode').estimatedCost).toBe(0.075)
  })

  it('uses the static table for non-opencode providers even on a catalog id', () => {
    // claude-opus-4-5 is $5/$25 in the OpenCode catalog, but a direct Anthropic
    // call must keep the table rate ($15/$75) for that id.
    expect(estimateCost('claude-opus-4-5', 1_000_000, 1_000_000, 'anthropic').estimatedCost).toBe(90)
    expect(estimateCost('claude-opus-4-5', 1_000_000, 1_000_000, 'opencode').estimatedCost).toBe(30)
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
