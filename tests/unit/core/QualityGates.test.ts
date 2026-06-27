import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>()
  return {
    ...actual,
    execSync: vi.fn(),
  }
})

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  }
})

import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { QualityGates } from '../../../src/core/QualityGates.js'

describe('QualityGates', () => {
  let gates: QualityGates

  beforeEach(() => {
    gates = new QualityGates()
    vi.mocked(execSync).mockReset()
    vi.mocked(existsSync).mockReset()
  })

  it('checks TypeScript compilation', () => {
    vi.mocked(execSync).mockReturnValue('')
    vi.mocked(existsSync).mockReturnValue(false)

    const results = gates.check('/test')
    const ts = results.find(r => r.name === 'TypeScript')!
    expect(ts.pass).toBe(true)
    expect(ts.detail).toContain('Compiles')
  })

  it('catches TypeScript errors', () => {
    const err = new Error('compilation error') as any
    err.stdout = 'src/file.ts:1: error TS2322: Type mismatch'
    vi.mocked(execSync).mockImplementation(() => { throw err })
    vi.mocked(existsSync).mockReturnValue(false)

    const results = gates.check('/test')
    const ts = results.find(r => r.name === 'TypeScript')!
    expect(ts.pass).toBe(false)
    expect(ts.detail).toContain('TS2322')
  })

  it('checks tests passing', () => {
    const mockOutput = JSON.stringify({ totalTests: 42, passedTests: 42, failedTests: 0 })
    vi.mocked(execSync)
      .mockReturnValueOnce('')         // tsc
      .mockReturnValueOnce(mockOutput) // vitest
      .mockImplementationOnce(() => { throw new Error('no branch') }) // git diff
    vi.mocked(existsSync).mockReturnValue(false)

    const results = gates.check('/test')
    const tests = results.find(r => r.name === 'Tests')!
    expect(tests.pass).toBe(true)
    expect(tests.detail).toContain('42')
  })

  it('catches test failures', () => {
    const mockOutput = JSON.stringify({ totalTests: 10, passedTests: 8, failedTests: 2 })
    vi.mocked(execSync)
      .mockReturnValueOnce('')
      .mockReturnValueOnce(mockOutput)
      .mockImplementationOnce(() => { throw new Error('no branch') })
    vi.mocked(existsSync).mockReturnValue(false)

    const results = gates.check('/test')
    const tests = results.find(r => r.name === 'Tests')!
    expect(tests.pass).toBe(false)
    expect(tests.detail).toContain('2')
  })

  it('skips lint when no eslint config', () => {
    vi.mocked(execSync)
      .mockReturnValueOnce('')
      .mockReturnValueOnce(JSON.stringify({ totalTests: 1, passedTests: 1, failedTests: 0 }))
      .mockImplementationOnce(() => { throw new Error('no branch') })
    vi.mocked(existsSync).mockReturnValue(false)

    const results = gates.check('/test')
    const lint = results.find(r => r.name === 'Lint')!
    expect(lint.pass).toBe(true)
    expect(lint.detail).toContain('No eslint config')
  })

  it('produces all four gate results', () => {
    vi.mocked(execSync)
      .mockReturnValueOnce('')
      .mockReturnValueOnce(JSON.stringify({ totalTests: 0, passedTests: 0, failedTests: 0 }))
      .mockImplementationOnce(() => { throw new Error('no branch') })
    vi.mocked(existsSync).mockReturnValue(false)

    const results = gates.check('/test')
    expect(results).toHaveLength(4)
    expect(results.map(r => r.name)).toEqual(['TypeScript', 'Tests', 'Impact', 'Lint'])
  })
})
