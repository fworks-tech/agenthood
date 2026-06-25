import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  }
})

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { ResidualMemory } from '../../../src/memory/ResidualMemory.js'

describe('ResidualMemory', () => {
  beforeEach(() => {
    vi.mocked(existsSync).mockReturnValue(false)
    vi.mocked(readFileSync).mockReturnValue('[]')
    vi.mocked(writeFileSync).mockReturnValue(undefined)
    vi.mocked(mkdirSync).mockReturnValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('record', () => {
    it('adds a new signal with initial strength', () => {
      const mem = new ResidualMemory()
      mem.record('user prefers concise answers', 0.7)
      const active = mem.getActive(0)
      expect(active).toHaveLength(1)
      expect(active[0].pattern).toBe('user prefers concise answers')
      expect(active[0].strength).toBe(0.7)
    })

    it('reinforces existing signal rather than duplicating', () => {
      const mem = new ResidualMemory()
      mem.record('user prefers concise answers', 0.5)
      mem.record('user prefers concise answers', 0.3)
      const active = mem.getActive(0)
      expect(active).toHaveLength(1)
      expect(active[0].strength).toBeCloseTo(0.8)
    })

    it('caps strength at 1.0', () => {
      const mem = new ResidualMemory()
      mem.record('pattern', 0.6)
      mem.record('pattern', 0.6)
      const active = mem.getActive(0)
      expect(active[0].strength).toBe(1.0)
    })
  })

  describe('decay', () => {
    it('reduces strength by decayRate per day', () => {
      const mem = new ResidualMemory()
      mem.record('pattern', 1.0)
      const signal = mem.getActive(0)[0]
      vi.setSystemTime(signal.lastReinforced.getTime() + 86400000)
      mem.decay()
      expect(mem.getActive(0)[0].strength).toBeCloseTo(0.9)
    })

    it('applies compound decay over multiple days', () => {
      const mem = new ResidualMemory()
      mem.record('pattern', 1.0)
      const signal = mem.getActive(0)[0]
      vi.setSystemTime(signal.lastReinforced.getTime() + 3 * 86400000)
      mem.decay()
      expect(mem.getActive(0)[0].strength).toBeCloseTo(0.729, 2)
    })

    it('does not change strength when called same day', () => {
      const mem = new ResidualMemory()
      mem.record('pattern', 0.8)
      mem.decay()
      expect(mem.getActive(0)[0].strength).toBeCloseTo(0.8)
    })

    it('uses custom decayRate when provided', () => {
      const mem = new ResidualMemory({ defaultDecayRate: 0.5 })
      mem.record('pattern', 1.0)
      const signal = mem.getActive(0)[0]
      vi.setSystemTime(signal.lastReinforced.getTime() + 86400000)
      mem.decay()
      expect(mem.getActive(0)[0].strength).toBeCloseTo(0.5)
    })
  })

  describe('getActive', () => {
    it('returns only signals above threshold', () => {
      const mem = new ResidualMemory()
      mem.record('strong', 0.9)
      mem.record('weak', 0.2)
      const active = mem.getActive(0.5)
      expect(active).toHaveLength(1)
      expect(active[0].pattern).toBe('strong')
    })

    it('prunes signals below 0.1', () => {
      const mem = new ResidualMemory()
      mem.record('strong', 0.9)
      mem.record('dying', 0.05)
      expect(mem.count()).toBe(2)
      mem.getActive(0)
      expect(mem.count()).toBe(1)
    })

    it('returns empty array when no signals meet threshold', () => {
      const mem = new ResidualMemory()
      mem.record('weak', 0.1)
      const active = mem.getActive(0.5)
      expect(active).toHaveLength(0)
    })
  })

  describe('toPromptHints', () => {
    it('formats active signals as readable lines', () => {
      const mem = new ResidualMemory()
      mem.record('user prefers concise answers', 0.9)
      mem.record('user likes python', 0.7)
      const hints = mem.toPromptHints()
      expect(hints).toContain('Residual memory traces:')
      expect(hints).toContain('confidence: 0.90')
      expect(hints).toContain('prefers concise answers')
    })

    it('returns empty string when no active signals', () => {
      const mem = new ResidualMemory()
      expect(mem.toPromptHints()).toBe('')
    })

    it('respects maxHints limit', () => {
      const mem = new ResidualMemory()
      for (let i = 0; i < 20; i++) {
        mem.record(`pattern-${i}`, 0.9)
      }
      const hints = mem.toPromptHints(3)
      const lines = hints.split('\n').filter((l) => l.startsWith('- '))
      expect(lines).toHaveLength(3)
    })
  })

  describe('persistence', () => {
    it('writes signals to file on save', () => {
      const mem = new ResidualMemory()
      mem.record('pattern', 0.8)
      mem.save('/tmp/residual.json')
      expect(writeFileSync).toHaveBeenCalled()
      const written = JSON.parse(vi.mocked(writeFileSync).mock.calls[0][1] as string)
      expect(written).toHaveLength(1)
      expect(written[0].pattern).toBe('pattern')
    })

    it('loads signals from file on construction', () => {
      const saved = JSON.stringify([
        { id: 't1', pattern: 'loaded pattern', strength: 0.8, lastReinforced: '2026-01-01T00:00:00.000Z', decayRate: 0.9 },
      ])
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue(saved)

      const mem = new ResidualMemory({ filePath: '/tmp/residual.json' })
      const active = mem.getActive(0)
      expect(active).toHaveLength(1)
      expect(active[0].pattern).toBe('loaded pattern')
    })

    it('starts empty when file does not exist', () => {
      vi.mocked(existsSync).mockReturnValue(false)

      const mem = new ResidualMemory({ filePath: '/tmp/residual.json' })
      expect(mem.count()).toBe(0)
    })

    it('creates directory on save if missing', () => {
      vi.mocked(existsSync).mockReturnValue(false)
      vi.mocked(mkdirSync).mockReturnValue(undefined)

      const mem = new ResidualMemory()
      mem.record('pattern', 0.8)
      mem.save('/new-dir/residual.json')

      expect(mkdirSync).toHaveBeenCalled()
      expect(writeFileSync).toHaveBeenCalled()
    })
  })

  describe('clear', () => {
    it('removes all signals', () => {
      const mem = new ResidualMemory()
      mem.record('a', 0.9)
      mem.record('b', 0.8)
      mem.clear()
      expect(mem.count()).toBe(0)
    })
  })
})
