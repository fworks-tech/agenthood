import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { handleCliError, userError, systemError } from '../../../src/core/cliError.ts'

describe('cliError', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>
  let exitSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit(${code})`)
    }) as never)
  })

  afterEach(() => {
    stderrSpy.mockRestore()
    exitSpy.mockRestore()
  })

  it('formats message with Fix and Docs', () => {
    try {
      handleCliError(new Error('bad input'), { fix: 'check syntax', docs: 'https://docs.example.com' })
    } catch { /* exit throws */ }
    expect(stderrSpy).toHaveBeenCalledWith('Error: bad input\n  Fix: check syntax\n  Docs: https://docs.example.com')
  })

  it('defaults to exit code 2 for system errors', () => {
    try { handleCliError(new Error('crash')) } catch { /* exit throws */ }
    expect(exitSpy).toHaveBeenCalledWith(2)
  })

  it('userError exits with code 1', () => {
    try { userError('invalid flag') } catch { /* exit throws */ }
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('systemError exits with code 2', () => {
    try { systemError('disk full') } catch { /* exit throws */ }
    expect(exitSpy).toHaveBeenCalledWith(2)
  })

  it('handles non-Error values', () => {
    try { handleCliError('string failure') } catch { /* exit throws */ }
    expect(stderrSpy).toHaveBeenCalledWith('Error: string failure')
  })
})
