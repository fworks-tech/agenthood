import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/workflows/definitions/review-pr.js', () => ({
  executeReviewPrWorkflow: vi.fn(),
}))

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>()
  return {
    ...actual,
    execSync: vi.fn(),
  }
})

import { workflow } from '../../../src/commands/workflow.js'
import { executeReviewPrWorkflow } from '../../../src/workflows/definitions/review-pr.js'

describe('workflow command', () => {
  beforeEach(() => {
    vi.mocked(executeReviewPrWorkflow).mockReset()
  })

  it('errors with no arguments', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)

    await workflow([])
    expect(exit).toHaveBeenCalledWith(1)
  })

  it('errors with unknown workflow name', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)

    await workflow(['unknown'])
    expect(exit).toHaveBeenCalledWith(1)
  })

  it('executes review-pr workflow', async () => {
    vi.mocked(executeReviewPrWorkflow).mockResolvedValue('test report')
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await workflow(['review-pr'])
    expect(executeReviewPrWorkflow).toHaveBeenCalled()
    expect(log).toHaveBeenCalled()
  })
})
