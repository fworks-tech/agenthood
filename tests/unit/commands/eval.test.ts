import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

vi.mock('../../../src/runtime/ApplicationContext.ts', () => ({
  ApplicationContext: { create: vi.fn() },
}))

import { evalMember, command } from '../../../src/commands/eval.js'
import { ApplicationContext } from '../../../src/runtime/ApplicationContext.ts'
import type { ILLMProvider } from '../../../src/llm/ILLMProvider.js'

const suitePath = join(process.cwd(), 'evals', 'benchmarks', 'review-pr.json')

function stubLlm(content = '0.8'): ILLMProvider {
  return {
    async complete(): Promise<{ content: string; usage: { promptTokens: number; completionTokens: number; totalTokens: number }; model: string }> {
      return { content, usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, model: 'stub' }
    },
    async stream(): Promise<never> {
      throw new Error('unused')
    },
    async embed(_text: string): Promise<number[]> {
      return [1, 0]
    },
    getContextWindow(): number { return 8192 },
    setModel: vi.fn(),
  }
}

function stubApp(llm: ILLMProvider, runTask = async () => ({ output: 'a thorough review', durationMs: 5 })) {
  return {
    members: { has: (n: string) => n === 'the-reviewer' },
    llm,
    runMemberTask: runTask,
  }
}

describe('eval command', () => {
  beforeEach(() => {
    vi.mocked(ApplicationContext.create).mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('exports a well-formed descriptor', () => {
    expect(command.name).toBe('eval')
    expect(command.description).toBeTruthy()
    expect(typeof command.handler).toBe('function')
  })

  it('prints usage when member or suite is missing', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('process.exit') }) as never)
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(evalMember([])).rejects.toThrow('process.exit')
    await expect(evalMember(['the-reviewer'])).rejects.toThrow('process.exit')

    expect(exit).toHaveBeenCalledWith(1)
    expect(err.mock.calls.flat().join(' ')).toContain('Usage: agenthood eval')
  })

  it('exits with 2 on an invalid suite file', async () => {
    vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('process.exit') }) as never)
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(evalMember(['the-reviewer', '--suite', join(tmpdir(), 'nope.json')])).rejects.toThrow('process.exit')
    expect(err.mock.calls.flat().join(' ')).toContain('Invalid eval suite')
  })

  it('exits with 1 on an unknown member', async () => {
    vi.mocked(ApplicationContext.create).mockResolvedValue(stubApp(stubLlm()))
    vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('process.exit') }) as never)
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(evalMember(['ghost', '--suite', suitePath])).rejects.toThrow('process.exit')
    expect(err.mock.calls.flat().join(' ')).toContain('Unknown member')
  })

  it('runs the suite and prints per-task scores and aggregate', async () => {
    const runTask = vi.fn(async () => ({ output: 'a thorough review', durationMs: 5 }))
    vi.mocked(ApplicationContext.create).mockResolvedValue(stubApp(stubLlm(), runTask))
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await evalMember(['the-reviewer', '--suite', suitePath])

    const output = log.mock.calls.flat().join(' ')
    expect(output).toContain('Eval Report — the-reviewer')
    expect(output).toContain('completed')
    expect(output).toContain('Aggregate: faithfulness 0.80, relevance 0.80, context_recall 0.80, answer_correctness 1.00')
    expect(runTask).toHaveBeenCalledTimes(3)
  })

  it('saves a baseline with --update-baseline', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'agenthood-eval-'))
    const baselineFile = join(dir, 'baseline.json')
    vi.mocked(ApplicationContext.create).mockResolvedValue(stubApp(stubLlm()))
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    try {
      await evalMember(['the-reviewer', '--suite', suitePath, '--baseline', baselineFile, '--update-baseline'])
      expect(existsSync(baselineFile)).toBe(true)
      expect(log.mock.calls.flat().join(' ')).toContain('Baseline saved')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('passes when scores match the baseline', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'agenthood-eval-'))
    const baselineFile = join(dir, 'baseline.json')
    vi.mocked(ApplicationContext.create).mockResolvedValue(stubApp(stubLlm()))
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    try {
      await evalMember(['the-reviewer', '--suite', suitePath, '--baseline', baselineFile, '--update-baseline'])
      log.mockClear()
      await evalMember(['the-reviewer', '--suite', suitePath, '--baseline', baselineFile])
      expect(log.mock.calls.flat().join(' ')).toContain('Result: PASS')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('exits with 1 when a regression is detected', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'agenthood-eval-'))
    const baselineFile = join(dir, 'baseline.json')
    vi.mocked(ApplicationContext.create).mockResolvedValue(stubApp(stubLlm()))
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    try {
      await evalMember(['the-reviewer', '--suite', suitePath, '--baseline', baselineFile, '--update-baseline'])

      vi.mocked(ApplicationContext.create).mockResolvedValue(stubApp(stubLlm('0.4')))
      vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('process.exit') }) as never)
      await expect(evalMember(['the-reviewer', '--suite', suitePath, '--baseline', baselineFile])).rejects.toThrow('process.exit')
      expect(log.mock.calls.flat().join(' ')).toContain('Result: FLAG')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('prints a hint when no baseline exists yet', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'agenthood-eval-'))
    vi.mocked(ApplicationContext.create).mockResolvedValue(stubApp(stubLlm()))
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    try {
      await evalMember(['the-reviewer', '--suite', suitePath, '--baseline', join(dir, 'missing.json')])
      expect(log.mock.calls.flat().join(' ')).toContain('--update-baseline')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
