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
    const def = createReviewPrWorkflow()
    expect(def.name).toBe('review-pr')
    expect(def.description).toBeTruthy()
    expect(def.steps.length).toBeGreaterThanOrEqual(3)
    expect(def.steps[0].name).toBe('analyze-impact')
  })

  it('executes workflow and returns report', async () => {
    vi.mocked(execSync)
      .mockReturnValueOnce('')         // tsc
      .mockReturnValueOnce(JSON.stringify({ totalTests: 5, passedTests: 5, failedTests: 0 })) // vitest
      .mockReturnValueOnce('1\t0\tsrc/commands/foo.ts\n') // git diff numstat
      .mockReturnValueOnce('M\tsrc/commands/foo.ts\n')    // git diff name-status
    vi.mocked(existsSync).mockReturnValue(false)

    const output = await executeReviewPrWorkflow()
    expect(output).toContain('Impact Analysis')
    expect(output).toContain('Quality Gates')
    expect(output).toContain('Summary')
    expect(output).toContain('Files changed: 1')
  })

  it('detects issues in the report', async () => {
    vi.mocked(execSync)
      .mockReturnValueOnce('')         // tsc
      .mockReturnValueOnce(JSON.stringify({ totalTests: 5, passedTests: 3, failedTests: 2 })) // vitest
      .mockReturnValueOnce('100\t0\tsrc/core/types.ts\n') // git diff numstat
      .mockReturnValueOnce('M\tsrc/core/types.ts\n')      // git diff name-status
    vi.mocked(existsSync).mockReturnValue(false)

    const output = await executeReviewPrWorkflow()
    expect(output).toContain('FAIL')
    expect(output).toContain('Issues detected')
  })
})
