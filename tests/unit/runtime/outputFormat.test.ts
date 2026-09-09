import { describe, it, expect, vi } from 'vitest'
import { validateOutputFormat, reportFormatDeviation, OutputFormatError } from '../../../src/runtime/outputFormat.ts'

describe('validateOutputFormat', () => {
  it('reports valid when output matches the pattern', () => {
    const { valid, message } = validateOutputFormat('## Plan\n## Build', '^## .+\n## .+')
    expect(valid).toBe(true)
    expect(message).toBe('')
  })

  it('reports invalid with expected vs actual when output does not match', () => {
    const { valid, message } = validateOutputFormat('just some text', '^## .+')
    expect(valid).toBe(false)
    expect(message).toContain('^## .+')
    expect(message).toContain('just some text')
  })

  it('truncates a long actual output in the message', () => {
    const long = 'x'.repeat(500)
    const { valid, message } = validateOutputFormat(long, '^## .+')
    expect(valid).toBe(false)
    expect(message.length).toBeLessThan(260)
    expect(message).toContain('…')
  })

  it('does not throw on an invalid regex pattern', () => {
    const { valid, message } = validateOutputFormat('output', '([invalid')
    expect(valid).toBe(false)
    expect(message).toContain('not a valid regex')
  })
})

describe('reportFormatDeviation', () => {
  it('throws OutputFormatError in strict mode', () => {
    expect(() => reportFormatDeviation('expected /x/, got: "y"', 'strict')).toThrow(OutputFormatError)
    expect(() => reportFormatDeviation('expected /x/, got: "y"', 'strict')).toThrow(/strict/)
  })

  it('warns and returns in lenient mode', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const result = reportFormatDeviation('expected /x/, got: "y"', 'lenient')
      expect(result).toBeUndefined()
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('lenient'))
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('expected /x/'))
    } finally {
      warnSpy.mockRestore()
    }
  })
})
