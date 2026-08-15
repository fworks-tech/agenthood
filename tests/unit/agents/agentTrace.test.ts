import { describe, it, expect } from 'vitest'
import { redactSafely } from '../../../src/agents/base/agentTrace.ts'
import { createTestContext } from '../../helpers/testContext.ts'
import { RedactionFilter } from '../../../src/core/RedactionFilter.ts'

describe('redactSafely', () => {
  const report = { event: 'test redaction failed', member: 'test-agent', model: 'mock-model' }

  it('redacts payloads when a redactor is configured', () => {
    const context = createTestContext({ redactor: new RedactionFilter({ enabled: true }) })
    expect(redactSafely(context, 'mail user@example.com', report)).toBe('mail [REDACTED]')
  })

  it("throws on redaction failure in 'throw' mode", () => {
    const context = { ...createTestContext(), redactor: undefined } as never
    expect(() => redactSafely(context, 'secret', report)).toThrow(/redaction requires a redactor/)
  })

  it("rethrows the original error in 'throw' mode when one exists", () => {
    const context = { ...createTestContext(), redactor: undefined } as never
    const original = new Error('original boom')
    expect(() => redactSafely(context, 'secret', { ...report, originalError: original })).toThrow('original boom')
  })

  it("returns undefined in 'skip' mode instead of throwing", () => {
    const context = { ...createTestContext(), redactor: undefined } as never
    expect(redactSafely(context, 'secret', { ...report, mode: 'skip' })).toBeUndefined()
  })

  it("ignores originalError in 'skip' mode", () => {
    const context = { ...createTestContext(), redactor: undefined } as never
    expect(redactSafely(context, 'secret', { ...report, mode: 'skip', originalError: new Error('boom') })).toBeUndefined()
  })
})
