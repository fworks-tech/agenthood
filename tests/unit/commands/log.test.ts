import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  }
})

import { existsSync, readFileSync } from 'node:fs'
import { log, command } from '../../../src/commands/log.ts'
import { createTraceEnvelope } from '../../../src/core/TraceEnvelope.ts'
import type { TraceEnvelope } from '../../../src/core/types.ts'

const logEnvelope = (member: string, level: string, message: string, timestamp: string): TraceEnvelope => ({
  member,
  inputHash: 'x',
  outputHash: 'y',
  durationMs: 0,
  tokenCount: { input: 0, output: 0, total: 0 },
  cost: 0,
  qualityScore: null,
  status: 'success',
  correlationId: 'corr-1',
  timestamp,
  source: 'cli',
  entryType: 'log',
  level: level as TraceEnvelope['level'],
  message,
})

const traceEnvelope = createTraceEnvelope({
  member: 'the-scribe',
  input: 'task',
  output: 'output',
  durationMs: 1500,
  tokenCount: { input: 100, output: 50, total: 150 },
  cost: 0.0012,
  qualityScore: 0.85,
  status: 'success',
  correlationId: 'corr-2',
  timestamp: '2026-07-01T09:00:00.000Z',
})

const logsNdjson = [
  logEnvelope('the-scribe', 'info', 'booted', '2026-07-01T10:00:00.000Z'),
  logEnvelope('the-warden', 'warn', 'complexity rising', '2026-07-01T11:00:00.000Z'),
  logEnvelope('system', 'error', 'provider down', '2026-07-01T12:00:00.000Z'),
  traceEnvelope,
].map((e) => JSON.stringify(e)).join('\n')

describe('log command', () => {
  beforeEach(() => {
    vi.mocked(existsSync).mockReset()
    vi.mocked(readFileSync).mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('exports a well-formed descriptor', () => {
    expect(command.name).toBe('log')
    expect(command.description).toBeTruthy()
    expect(typeof command.handler).toBe('function')
  })

  it('prints a friendly message when no log entries exist yet', async () => {
    vi.mocked(existsSync).mockReturnValue(false)
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await log()

    expect(logSpy.mock.calls.flat().join(' ')).toContain('No log entries recorded yet')
  })

  it('lists log entries in a formatted table and excludes trace envelopes', async () => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockReturnValue(logsNdjson)
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await log()

    const output = logSpy.mock.calls.flat().join(' ')
    expect(output).toContain('booted')
    expect(output).toContain('complexity rising')
    expect(output).toContain('provider down')
    expect(output).not.toContain('$0.0012')
    expect(output).not.toContain('task')
  })

  it('filters by --level', async () => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockReturnValue(logsNdjson)
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await log(['--level', 'warn'])

    const output = logSpy.mock.calls.flat().join(' ')
    expect(output).toContain('complexity rising')
    expect(output).not.toContain('booted')
    expect(output).not.toContain('provider down')
  })

  it('filters by --member', async () => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockReturnValue(logsNdjson)
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await log(['--member', 'the-scribe'])

    const output = logSpy.mock.calls.flat().join(' ')
    expect(output).toContain('booted')
    expect(output).not.toContain('complexity rising')
  })

  it('respects --limit with newest entries first', async () => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockReturnValue(logsNdjson)
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await log(['--limit', '1'])

    const output = logSpy.mock.calls.flat().join(' ')
    expect(output).toContain('provider down')
    expect(output).not.toContain('booted')
  })

  it('produces parseable JSON with --json', async () => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockReturnValue(logsNdjson)
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await log(['--json', '--limit', '5'])

    const raw = logSpy.mock.calls.flat().join('')
    const parsed = JSON.parse(raw)
    expect(parsed.entries).toHaveLength(3)
    expect(parsed.entries[0].message).toBe('provider down')
    expect(parsed.entries[0].level).toBe('error')
  })

  it('rejects invalid --level values', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    await log(['--level', 'verbose'])

    expect(error).toHaveBeenCalled()
    expect(exit).toHaveBeenCalledWith(1)
  })

  it('prints help text on --help', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await log(['--help'])

    expect(logSpy.mock.calls.flat().join(' ')).toContain('--level <level>')
  })
})