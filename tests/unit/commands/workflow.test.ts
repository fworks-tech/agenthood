import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

vi.mock('../../../src/workflows/definitions/review-pr.ts', () => ({
  executeReviewPrWorkflow: vi.fn(),
}))

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>()
  return {
    ...actual,
    execSync: vi.fn(),
  }
})

import { workflow } from '../../../src/commands/workflow.ts'
import { executeReviewPrWorkflow } from '../../../src/workflows/definitions/review-pr.ts'

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

  it('names chains.yaml instead of dumping a parser error when the file is malformed', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'chains-'))
    writeFileSync(join(dir, 'chains.yaml'), 'chains: [unclosed\n')
    vi.spyOn(process, 'cwd').mockReturnValue(dir)
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('exit') }) as any)
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await expect(workflow(['list'])).rejects.toThrow('exit')
      expect(exit).toHaveBeenCalledWith(1)
      expect(error.mock.calls.flat().join(' ')).toContain('Could not read chains.yaml')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('executes review-pr workflow', async () => {
    vi.mocked(executeReviewPrWorkflow).mockResolvedValue('test report')
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await workflow(['review-pr'])
    expect(executeReviewPrWorkflow).toHaveBeenCalled()
    expect(log).toHaveBeenCalled()
  })
})
