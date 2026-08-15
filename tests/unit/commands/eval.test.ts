import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, existsSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

vi.mock('../../../src/runtime/ApplicationContext.ts', () => ({
  ApplicationContext: { create: vi.fn() },
}))

import { evalMember, command } from '../../../src/commands/eval.ts'
import { ApplicationContext } from '../../../src/runtime/ApplicationContext.ts'
import type { ILLMProvider } from '../../../src/llm/ILLMProvider.ts'

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
    ctx: { source: undefined },
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

describe('eval --replay', () => {
  let projectDir: string
  const originalCwd = process.cwd()

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), 'agenthood-replay-'))
    process.chdir(projectDir)
    mkdirSync(join(projectDir, '.agenthood', 'traces'), { recursive: true })
    vi.mocked(ApplicationContext.create).mockReset()
  })

  afterEach(() => {
    process.chdir(originalCwd)
    rmSync(projectDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  function writeTrace(member: string, input: string, output: string): void {
    const envelope = {
      member,
      inputHash: 'a'.repeat(64),
      outputHash: 'b'.repeat(64),
      durationMs: 5,
      tokenCount: { input: 1, output: 1, total: 2 },
      cost: 0.001,
      qualityScore: null,
      status: 'success',
      correlationId: 'corr-1',
      timestamp: new Date().toISOString(),
      source: 'cli',
      input,
      output,
    }
    const file = join(projectDir, '.agenthood', 'traces', 'traces.ndjson')
    const existing = existsSync(file) ? readFileSync(file, 'utf8') : ''
    writeFileSync(file, existing + JSON.stringify(envelope) + '\n')
  }

  function stubReplayApp(llm: ILLMProvider, output = 'rerun output', embedResult: number[] = [1, 0]) {
    vi.mocked(ApplicationContext.create).mockResolvedValue({
      ctx: { source: undefined },
      members: { has: (n: string) => n === 'the-reviewer' },
      llm: {
        ...llm,
        embed: vi.fn().mockResolvedValue(embedResult),
      },
      runMemberTask: vi.fn().mockResolvedValue({ output, durationMs: 3 }),
    } as never)
  }

  it('replays stored traces and reports drift in JSON', async () => {
    writeTrace('the-reviewer', 'review this PR', 'looks good')
    stubReplayApp(stubLlm())
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await evalMember(['the-reviewer', '--replay', '--json'])

    const output = log.mock.calls.flat().join(' ')
    const report = JSON.parse(output)
    expect(report.replayCount).toBe(1)
    expect(report.tasks[0].member).toBe('the-reviewer')
    expect(report.tasks[0].newOutput).toBe('rerun output')
    expect(report.tasks[0].similarity).not.toBeNull()
  })

  it('persists the report file under .agenthood/evals', async () => {
    writeTrace('the-reviewer', 'review this PR', 'looks good')
    stubReplayApp(stubLlm())
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await evalMember(['the-reviewer', '--replay'])

    expect(log.mock.calls.flat().join(' ')).toContain('Replay Report')
    const reportPath = join(projectDir, '.agenthood', 'evals', 'replay-report.json')
    expect(existsSync(reportPath)).toBe(true)
    const report = JSON.parse(readFileSync(reportPath, 'utf8'))
    expect(report.replayCount).toBe(1)
  })

  it('redacts re-run output before persisting when redaction is enabled', async () => {
    writeTrace('the-reviewer', 'review this PR', 'looks good')
    mkdirSync(join(projectDir, '.agenthood'), { recursive: true })
    writeFileSync(
      join(projectDir, '.agenthood', 'config.json'),
      JSON.stringify({ observability: { redaction: { enabled: true } } }),
    )
    stubReplayApp(stubLlm(), 'contact dev@example.com with sk-abc1234567')

    await evalMember(['the-reviewer', '--replay'])

    const report = JSON.parse(readFileSync(join(projectDir, '.agenthood', 'evals', 'replay-report.json'), 'utf8'))
    expect(report.tasks[0].newOutput).toContain('[REDACTED]')
    expect(report.tasks[0].newOutput).not.toContain('dev@example.com')
  })

  it('errors when no traces exist for the member', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('process.exit') }) as never)
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(evalMember(['the-reviewer', '--replay'])).rejects.toThrow('process.exit')

    expect(err.mock.calls.flat().join(' ')).toContain('No traces')
    expect(exit).toHaveBeenCalledWith(1)
  })
})
