import { describe, it, expect } from 'vitest'
import { countTokens } from '../../../src/core/modelPricing.ts'

describe('countTokens', () => {
  it('counts tokens via chars/4 heuristic', () => {
    expect(countTokens('')).toBe(0)
    expect(countTokens('a'.repeat(400))).toBe(100)
    expect(countTokens('short text')).toBeGreaterThan(0)
  })

  it('counts at least one token for non-empty input', () => {
    expect(countTokens('a')).toBe(1)
  })
})
