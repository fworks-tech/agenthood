import { describe, it, expect } from 'vitest'
import { TokenCounter } from '../../../src/core/TokenCounter.ts'

describe('TokenCounter', () => {
  const counter = new TokenCounter()

  it('counts tokens via chars/4 heuristic', () => {
    expect(counter.countTokens('')).toBe(0)
    expect(counter.countTokens('a'.repeat(400))).toBe(100)
    expect(counter.countTokens('short text')).toBeGreaterThan(0)
  })

  it('counts at least one token for non-empty input', () => {
    expect(counter.countTokens('a')).toBe(1)
  })

  it('estimates cost for known models', () => {
    // gpt-4o: $2.50/1M input, $10/1M output
    expect(counter.estimateCost('gpt-4o', 1_000_000, 1_000_000)).toBe(12.5)
    expect(counter.estimateCost('gpt-4o', 0, 0)).toBe(0)
  })

  it('estimates cost for groq and anthropic models', () => {
    // llama-3.1-8b: $0.05/1M input, $0.08/1M output
    expect(counter.estimateCost('llama-3.1-8b-instant', 1_000_000, 1_000_000)).toBe(0.13)
    // claude-3-5-sonnet: $3/1M input, $15/1M output
    expect(counter.estimateCost('claude-3-5-sonnet-20241022', 1_000_000, 0)).toBe(3)
  })

  it('treats ollama models as free', () => {
    expect(counter.estimateCost('llama3:8b', 500_000, 500_000)).toBe(0)
  })

  it('estimates cost for opencode go models', () => {
    // deepseek-v4-flash: $0.14/1M in, $0.28/1M out (opencode.ai/docs/go)
    expect(counter.estimateCost('deepseek-v4-flash', 1_000_000, 1_000_000)).toBe(0.42)
    expect(counter.estimateCost('deepseek-v4-flash', 500_000, 0)).toBe(0.07)
    expect(counter.estimateCost('grok-4.5', 1_000_000, 1_000_000)).toBe(8)
  })

  it('handles unknown models gracefully with fallback pricing', () => {
    const cost = counter.estimateCost('totally-unknown-model', 1_000_000, 1_000_000)
    expect(cost).toBe(4) // fallback $1/1M in + $3/1M out
  })
})
