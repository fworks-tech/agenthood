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
import { createReviewPrWorkflow, executeReviewPrWorkflow } from '../../../../src/workflows/definitions/review-pr.js'

describe('review-pr workflow', () => {
  beforeEach(() => {
    vi.mocked(execSync).mockReset()
    vi.mocked(existsSync).mockReset()
  })

  it('creates a valid workflow definition', () => {
    const { definition, protocols } = createReviewPrWorkflow()
    expect(definition.name).toBe('review-pr')
    expect(definition.description).toBeTruthy()
    expect(definition.steps.length).toBeGreaterThanOrEqual(3)
    expect(definition.steps[0].name).toBe('analyze-impact')
    expect(protocols.length).toBe(2)
  })

  it('executes workflow and returns report', async () => {
    const calls = vi.mocked(execSync)
    // ImpactProtocol: git diff numstat + name-status
    calls.mockReturnValueOnce('1\t0\tsrc/commands/foo.ts\n')
    calls.mockReturnValueOnce('M\tsrc/commands/foo.ts\n')
    // QualityGatesProtocol: tsc + vitest
    calls.mockReturnValueOnce('')
    calls.mockReturnValueOnce(JSON.stringify({ numTotalTests: 5, numPassedTests: 5, numFailedTests: 0 }))
    vi.mocked(existsSync).mockReturnValue(false)

    const output = await executeReviewPrWorkflow()
    expect(output).toContain('Impact Analysis')
    expect(output).toContain('Quality Gates')
    expect(output).toContain('Summary')
    expect(output).toContain('Files changed: 1')
  })

  it('detects issues in the report', async () => {
    const calls = vi.mocked(execSync)
    calls.mockReturnValueOnce('100\t0\tsrc/core/types.ts\n')
    calls.mockReturnValueOnce('M\tsrc/core/types.ts\n')
    calls.mockReturnValueOnce('')
    calls.mockReturnValueOnce(JSON.stringify({ numTotalTests: 5, numPassedTests: 3, numFailedTests: 2 }))
    vi.mocked(existsSync).mockReturnValue(false)

    const output = await executeReviewPrWorkflow()
    expect(output).toContain('FAIL')
    expect(output).toContain('Issues detected')
  })
})
