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
import { trace, command } from '../../../src/commands/trace.js'
import { createTraceEnvelope } from '../../../src/core/TraceEnvelope.js'

const envelope = (member: string, timestamp: string, status = 'success') =>
  createTraceEnvelope({
    member,
    input: 'task',
    output: 'output',
    durationMs: 1500,
    tokenCount: { input: 100, output: 50, total: 150 },
    cost: 0.0012,
    qualityScore: 0.85,
    status: status as 'success' | 'error',
    correlationId: 'corr-1',
    timestamp,
  })

const tracesNdjson = [
  envelope('the-scribe', '2026-07-01T10:00:00.000Z'),
  envelope('the-reviewer', '2026-07-01T11:00:00.000Z', 'error'),
].map((e) => JSON.stringify(e)).join('\n')

describe('trace command', () => {
  beforeEach(() => {
    vi.mocked(existsSync).mockReset()
    vi.mocked(readFileSync).mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('exports a well-formed descriptor', () => {
    expect(command.name).toBe('trace')
    expect(command.description).toBeTruthy()
    expect(typeof command.handler).toBe('function')
  })

  it('prints a friendly message when no traces exist yet', async () => {
    vi.mocked(existsSync).mockReturnValue(false)
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await trace()

    expect(log.mock.calls.flat().join(' ')).toContain('No traces recorded yet')
  })

  it('lists traces in a formatted table', async () => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockReturnValue(tracesNdjson)
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await trace()

    const output = log.mock.calls.flat().join(' ')
    expect(output).toContain('the-scribe')
    expect(output).toContain('the-reviewer')
    expect(output).toContain('$0.0012')
    expect(output).toContain('error')
  })

  it('filters by --member', async () => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockReturnValue(tracesNdjson)
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await trace(['--member', 'the-scribe'])

    const output = log.mock.calls.flat().join(' ')
    expect(output).toContain('the-scribe')
    expect(output).not.toContain('the-reviewer')
  })

  it('returns empty message when filter matches nothing', async () => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockReturnValue(tracesNdjson)
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await trace(['--member', 'the-architect'])

    expect(log.mock.calls.flat().join(' ')).toContain('No traces match')
  })

  it('respects --limit', async () => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockReturnValue(tracesNdjson)
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await trace(['--limit', '1'])

    const output = log.mock.calls.flat().join(' ')
    expect(output).toContain('the-reviewer') // newest first
    expect(output).not.toContain('the-scribe')
  })

  it('filters by --since', async () => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockReturnValue(tracesNdjson)
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await trace(['--since', '2026-07-01T10:30:00.000Z'])

    const output = log.mock.calls.flat().join(' ')
    expect(output).toContain('the-reviewer')
    expect(output).not.toContain('the-scribe')
  })

  it('produces parseable JSON with --json', async () => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockReturnValue(tracesNdjson)
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await trace(['--json', '--limit', '5'])

    const raw = log.mock.calls.flat().join('')
    const parsed = JSON.parse(raw)
    expect(parsed.traces).toHaveLength(2)
    expect(parsed.traces[0].member).toBe('the-reviewer')
  })

  it('rejects invalid --since values', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    await trace(['--since', 'not-a-date'])

    expect(error).toHaveBeenCalled()
    expect(exit).toHaveBeenCalledWith(1)
  })

  it('prints help text on --help', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await trace(['--help'])

    expect(log.mock.calls.flat().join(' ')).toContain('--member <name>')
  })
})
