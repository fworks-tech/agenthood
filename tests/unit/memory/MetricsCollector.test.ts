import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    readdirSync: vi.fn(),
  }
})

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { MetricsCollector } from '../../../src/memory/MetricsCollector.js'

describe('MetricsCollector', () => {
  let collector: MetricsCollector
  const testDir = '/test/.agenthood/metrics'

  beforeEach(() => {
    vi.mocked(existsSync).mockReset()
    vi.mocked(readdirSync).mockReset()
    vi.mocked(writeFileSync).mockReset()
    vi.mocked(mkdirSync).mockReset()
    vi.mocked(existsSync).mockReturnValue(false)
    vi.mocked(readdirSync).mockReturnValue([])
    vi.mocked(writeFileSync).mockReturnValue(undefined)
    vi.mocked(mkdirSync).mockReturnValue(undefined)
    collector = new MetricsCollector(testDir)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('record', () => {
    it('creates metrics file for first invocation', () => {
      collector.record('the-scribe', true, 1500)

      expect(mkdirSync).toHaveBeenCalledWith(testDir, { recursive: true })
      expect(writeFileSync).toHaveBeenCalledTimes(1)
      const call = vi.mocked(writeFileSync).mock.calls[0]
      const written = JSON.parse(call[1] as string)
      expect(written.invocations).toBe(1)
      expect(written.successes).toBe(1)
      expect(written.failures).toBe(0)
      expect(written.totalDurationMs).toBe(1500)
      expect(written.lastRun).toBeDefined()
    })

    it('records failure correctly', () => {
      vi.mocked(writeFileSync).mockClear()
      collector.record('the-scribe', false, 500)

      const calls = vi.mocked(writeFileSync).mock.calls.filter((c) => (c[1] as string).includes('invocations'))
      expect(calls).toHaveLength(1)
      const written = JSON.parse(calls[0][1] as string)
      expect(written.invocations).toBe(1)
      expect(written.successes).toBe(0)
      expect(written.failures).toBe(1)
    })

    it('updates existing metrics on second invocation', () => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        invocations: 1, successes: 1, failures: 0, totalDurationMs: 1000, lastRun: '2026-01-01T00:00:00.000Z',
      }))

      collector.record('the-scribe', true, 2000)

      const call = vi.mocked(writeFileSync).mock.calls[0]
      const written = JSON.parse(call[1] as string)
      expect(written.invocations).toBe(2)
      expect(written.successes).toBe(2)
      expect(written.totalDurationMs).toBe(3000)
    })
  })

  describe('getStats', () => {
    it('returns null when no stats exist', () => {
      vi.mocked(existsSync).mockReturnValue(false)
      expect(collector.getStats('the-scribe')).toBeNull()
    })

    it('parses stored metrics', () => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        invocations: 5, successes: 4, failures: 1, totalDurationMs: 10000, lastRun: '2026-06-01T00:00:00.000Z',
      }))

      const stats = collector.getStats('the-scribe')
      expect(stats).not.toBeNull()
      expect(stats!.invocations).toBe(5)
      expect(stats!.successes).toBe(4)
    })
  })

  describe('getAllStats', () => {
    it('returns empty array when directory missing', () => {
      vi.mocked(existsSync).mockReturnValue(false)
      expect(collector.getAllStats()).toEqual([])
    })

    it('returns all member stats sorted by invocations descending', () => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readdirSync).mockReturnValue(['the-scribe.json', 'the-architect.json'] as any)
      vi.mocked(readFileSync)
        .mockReturnValueOnce(JSON.stringify({ invocations: 3, successes: 3, failures: 0, totalDurationMs: 3000, lastRun: null }))
        .mockReturnValueOnce(JSON.stringify({ invocations: 5, successes: 4, failures: 1, totalDurationMs: 5000, lastRun: null }))

      const all = collector.getAllStats()
      expect(all).toHaveLength(2)
      expect(all[0].member).toBe('the-architect')
      expect(all[1].member).toBe('the-scribe')
    })
  })

  describe('getSuccessRate', () => {
    it('returns null for member with no invocations', () => {
      vi.mocked(existsSync).mockReturnValue(false)
      expect(collector.getSuccessRate('the-scribe')).toBeNull()
    })

    it('calculates success rate', () => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        invocations: 10, successes: 7, failures: 3, totalDurationMs: 0, lastRun: null,
      }))
      expect(collector.getSuccessRate('the-scribe')).toBe(0.7)
    })
  })

  describe('getAverageDuration', () => {
    it('returns null for member with no invocations', () => {
      vi.mocked(existsSync).mockReturnValue(false)
      expect(collector.getAverageDuration('the-scribe')).toBeNull()
    })

    it('calculates average duration', () => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        invocations: 4, successes: 4, failures: 0, totalDurationMs: 10000, lastRun: null,
      }))
      expect(collector.getAverageDuration('the-scribe')).toBe(2500)
    })
  })

  describe('getStaleMembers', () => {
    it('returns members without recent activity', () => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readdirSync).mockReturnValue(['the-scribe.json', 'the-architect.json'] as any)
      const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
      vi.mocked(readFileSync)
        .mockReturnValueOnce(JSON.stringify({ invocations: 1, successes: 1, failures: 0, totalDurationMs: 100, lastRun: oldDate }))
        .mockReturnValueOnce(JSON.stringify({ invocations: 5, successes: 5, failures: 0, totalDurationMs: 500, lastRun: new Date().toISOString() }))

      const stale = collector.getStaleMembers(7)
      expect(stale).toHaveLength(1)
      expect(stale[0].member).toBe('the-scribe')
    })
  })
})
