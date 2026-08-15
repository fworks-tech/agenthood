import { describe, it, expect, vi, beforeEach } from 'vitest'

const vectorStoreMock = vi.hoisted(() => {
  const mockQuery = vi.fn()
  const mockOpenTable = vi.fn()
  class MockQuery {
    private _limit = 0
    private _filter = ''
    limit(n: number) {
      this._limit = n
      return this
    }
    filter(f: string) {
      this._filter = f
      return this
    }
    toArray() {
      return mockQuery(this._limit, this._filter)
    }
  }
  return {
    mockQuery,
    mockOpenTable,
    MockTable: class MockTable {
      query() {
        return new MockQuery()
      }
    },
  }
})

vi.mock('@lancedb/lancedb', () => ({
  connect: vi.fn().mockResolvedValue({
    openTable: vectorStoreMock.mockOpenTable,
    createEmptyTable: vi.fn(),
  }),
}))

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  }
})

vi.mock('../../../src/utils/hash.ts', () => ({
  contentHash: vi.fn(() => 'abc123'),
}))

import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { status } from '../../../src/commands/status.ts'

describe('status command', () => {
  beforeEach(() => {
    vi.mocked(existsSync).mockReset()
    vi.mocked(readdirSync).mockReset()
    vi.mocked(readFileSync).mockReset()
    vi.mocked(writeFileSync).mockReset()
    vi.mocked(mkdirSync).mockReset()
    vi.mocked(existsSync).mockReturnValue(false)
    vi.mocked(readdirSync).mockReturnValue([])
    vi.mocked(readFileSync).mockReturnValue('')
    vi.mocked(writeFileSync).mockReturnValue(undefined)
    vi.mocked(mkdirSync).mockReturnValue(undefined)
  })

  it('shows all zeros when nothing is set up', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await status()

    const output = log.mock.calls.flat().join(' ')
    expect(output).toContain('Members:     0')
    expect(output).toContain('Decisions:   0')
    expect(output).toContain('Lockfile:    absent')
    expect(output).toContain('Memory:      not initialized')
  })

  it('shows member count from config', async () => {
    vi.mocked(existsSync).mockImplementation((path) => {
      const p = path as string
      return p.includes('config.json') || p.includes('lock')
    })
    vi.mocked(readFileSync).mockImplementation((path) => {
      const p = path as string
      if (p.includes('config.json')) return JSON.stringify({ version: '1', members: ['the-scribe', 'the-architect'] })
      return ''
    })

    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await status()

    const output = log.mock.calls.flat().join(' ')
    expect(output).toContain('Members:     2')
  })

  it('shows valid lockfile status', async () => {
    vi.mocked(existsSync).mockImplementation((path) => {
      const p = path as string
      return p.includes('lock')
    })
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ version: 1, members: { 'the-scribe': {}, 'the-architect': {} } }))

    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await status()

    const output = log.mock.calls.flat().join(' ')
    expect(output).toContain('valid (2 members locked)')
  })

  it('shows invalid lockfile when parsing fails', async () => {
    vi.mocked(existsSync).mockImplementation((path) => {
      const p = path as string
      return p.includes('lock')
    })
    vi.mocked(readFileSync).mockReturnValue('not valid json')

    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await status()

    const output = log.mock.calls.flat().join(' ')
    expect(output).toContain('Lockfile:    invalid')
  })

  it('shows memory initialized when .agenthood/memory exists', async () => {
    vi.mocked(existsSync).mockImplementation((path) => {
      const p = path as string
      return p.includes('memory') || p.includes('lock')
    })
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ version: 1, members: {} }))

    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await status()

    const output = log.mock.calls.flat().join(' ')
    expect(output).toContain('Memory:      initialized')
  })

  it('outputs JSON with --json flag', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await status(['--json'])

    const lastCall = log.mock.calls[log.mock.calls.length - 1][0]
    const parsed = JSON.parse(lastCall as string)
    expect(parsed).toHaveProperty('members', 0)
    expect(parsed).toHaveProperty('lockfile', 'absent')
  })

  it('reports no drift with --drift when lockfile matches', async () => {
    vi.mocked(existsSync).mockImplementation((path) => {
      const p = path as string
      return p.includes('lock') || p.includes('.agenthood')
    })
    vi.mocked(readdirSync).mockImplementation((path) => {
      const p = path as string
      if (p.includes('skills')) return [{ name: 'the-scribe', isDirectory: () => true }] as any
      return []
    })
    vi.mocked(readFileSync).mockImplementation((path) => {
      const p = path as string
      if (p.includes('the-scribe.md')) return 'some content'
      return JSON.stringify({ version: 1, members: { 'the-scribe': { version: 'abc123' } } })
    })

    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    await status(['--drift'])

    const output = log.mock.calls.flat().join(' ')
    expect(output).toContain('No drift detected')
    expect(exit).toHaveBeenCalledWith(0)
  })

  it('reports drift when lockfile hash differs', async () => {
    vi.mocked(existsSync).mockImplementation((path) => {
      const p = path as string
      return p.includes('lock') || p.includes('.agenthood')
    })
    vi.mocked(readdirSync).mockImplementation((path) => {
      const p = path as string
      if (p.includes('skills')) return [{ name: 'the-scribe', isDirectory: () => true }] as any
      return []
    })
    vi.mocked(readFileSync).mockImplementation((path) => {
      const p = path as string
      if (p.includes('the-scribe.md')) return 'some content'
      return JSON.stringify({ version: 1, members: { 'the-scribe': { version: 'def456' } } })
    })

    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    await status(['--drift'])

    const output = log.mock.calls.flat().join(' ')
    expect(output).toContain('Drift detected')
    expect(output).toContain('the-scribe')
    expect(exit).toHaveBeenCalledWith(0)
  })

  it('shows a message when --member has no traces yet', async () => {
    vi.mocked(existsSync).mockReturnValue(false)
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await status(['--member', 'the-scribe'])

    expect(log.mock.calls.flat().join(' ')).toContain('No traces recorded')
  })

  it('prints a per-member window table with --member', async () => {
    const traces = [
      { member: 'the-scribe', cost: 0.01, qualityScore: 0.8, durationMs: 100, tokenCount: { input: 10, output: 5, total: 15 }, status: 'success', timestamp: new Date().toISOString() },
    ].map((e) => JSON.stringify(e)).join('\n')
    vi.mocked(existsSync).mockImplementation((path) => (path as string).includes('traces'))
    vi.mocked(readFileSync).mockReturnValue(traces)

    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await status(['--member', 'the-scribe'])

    const output = log.mock.calls.flat().join(' ')
    expect(output).toContain('Trace Summary — the-scribe')
    expect(output).toContain('1h')
    expect(output).toContain('24h')
    expect(output).toContain('7d')
    expect(output).toContain('all')
  })

  it('outputs parseable JSON with --member --json', async () => {
    const traces = [
      { member: 'the-scribe', cost: 0.02, qualityScore: null, durationMs: 200, tokenCount: { input: 20, output: 10, total: 30 }, status: 'success', timestamp: new Date().toISOString() },
    ].map((e) => JSON.stringify(e)).join('\n')
    vi.mocked(existsSync).mockImplementation((path) => (path as string).includes('traces'))
    vi.mocked(readFileSync).mockReturnValue(traces)

    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await status(['--member', 'the-scribe', '--json'])

    const lastCall = log.mock.calls[log.mock.calls.length - 1][0]
    const parsed = JSON.parse(lastCall as string)
    expect(parsed.member).toBe('the-scribe')
    expect(parsed.all.callCount).toBe(1)
    expect(parsed.all.totalCost).toBeCloseTo(0.02, 4)
  })
})

describe('status --learner', () => {
  it('queries persisted patterns with the ltm: key prefix', async () => {
    vectorStoreMock.mockOpenTable.mockResolvedValue(new vectorStoreMock.MockTable())
    vectorStoreMock.mockQuery.mockResolvedValue([])
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await status(['--learner', '--json'])

    const filters = vectorStoreMock.mockQuery.mock.calls.map((c) => c[1] as string)
    expect(filters.some((f) => f.includes('ltm:learnings%'))).toBe(true)
    expect(filters.some((f) => f.includes('ltm:antipatterns%'))).toBe(true)
    expect(filters.some((f) => f.includes(`LIKE 'learnings%'`))).toBe(false)
    const output = log.mock.calls.flat().join(' ')
    expect(output).toContain('persisted')
  })
})

describe('status --alerts', () => {
  it('prints a message when no alerts exist yet', async () => {
    vi.mocked(existsSync).mockReturnValue(false)
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await status(['--alerts'])

    expect(log.mock.calls.flat().join(' ')).toContain('No anomaly alerts')
  })

  it('renders recent alerts from the anomalies file', async () => {
    vi.mocked(existsSync).mockImplementation((path) => (path as string).includes('anomalies.ndjson'))
    vi.mocked(readFileSync).mockReturnValue(
      '{"type":"cost_spike","member":"the-builder","current":4,"baseline":0.5,"timestamp":"2026-08-14T00:00:00.000Z"}\n' +
      '{"type":"quality_drop","member":"the-reviewer","current":0.4,"baseline":0.8,"timestamp":"2026-08-14T00:01:00.000Z"}\n',
    )
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await status(['--alerts'])

    const output = log.mock.calls.flat().join(' ')
    expect(output).toContain('cost_spike')
    expect(output).toContain('quality_drop')
    expect(output).toContain('the-builder')
  })

  it('outputs JSON with --alerts --json', async () => {
    vi.mocked(existsSync).mockImplementation((path) => (path as string).includes('anomalies.ndjson'))
    vi.mocked(readFileSync).mockReturnValue('{"type":"cost_spike","member":"the-builder","current":4,"baseline":0.5,"timestamp":"2026-08-14T00:00:00.000Z"}\n')
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await status(['--alerts', '--json'])

    // console.log is a shared spy across tests in this file, so read only the
    // last call this test produced
    const lastCall = log.mock.calls.at(-1)?.[0] ?? ''
    const parsed = JSON.parse(lastCall)
    expect(parsed.count).toBe(1)
    expect(parsed.alerts[0].type).toBe('cost_spike')
  })
})
