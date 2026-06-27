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
import { DecisionLog } from '../../../src/memory/DecisionLog.js'
import type { DecisionEntry } from '../../../src/memory/DecisionLog.js'

const fixtureEntry: DecisionEntry = {
  id: 'dec-20260601-001',
  timestamp: '2026-06-01T12:00:00.000Z',
  member: 'the-architect',
  task: 'choose vector store for memory layer',
  decision: 'Use LanceDB for vector storage',
  rationale: 'LanceDB provides embedded vector search without external services',
  alternatives: [
    { option: 'Pinecone', reason: 'requires cloud service' },
    { option: 'pgvector', reason: 'requires PostgreSQL' },
  ],
  outcome: 'accepted',
  tags: ['memory', 'infrastructure'],
}

describe('DecisionLog', () => {
  beforeEach(() => {
    vi.mocked(existsSync).mockReturnValue(false)
    vi.mocked(readdirSync).mockReturnValue([])
    vi.mocked(writeFileSync).mockReturnValue(undefined)
    vi.mocked(mkdirSync).mockReturnValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('record', () => {
    it('writes entry to decisions directory', async () => {
      const log = new DecisionLog()
      await log.record(fixtureEntry)

      expect(writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('dec-20260601-001.json'),
        expect.any(String),
        'utf8',
      )
      const written = JSON.parse(vi.mocked(writeFileSync).mock.calls[0][1] as string)
      expect(written.id).toBe('dec-20260601-001')
      expect(written.member).toBe('the-architect')
    })

    it('creates directory if missing', async () => {
      const log = new DecisionLog()
      await log.record(fixtureEntry)

      expect(mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true })
    })

    it('can retrieve recorded entry from cache', async () => {
      const log = new DecisionLog()
      await log.record(fixtureEntry)

      const entry = await log.get('dec-20260601-001')
      expect(entry).toBeDefined()
      expect(entry!.decision).toBe('Use LanceDB for vector storage')
    })
  })

  describe('get', () => {
    it('returns undefined for non-existent entry', async () => {
      const log = new DecisionLog()
      const entry = await log.get('non-existent')
      expect(entry).toBeUndefined()
    })

    it('loads from file when not in cache', async () => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(fixtureEntry))

      const log = new DecisionLog()
      const entry = await log.get('dec-20260601-001')
      expect(entry).toBeDefined()
      expect(entry!.member).toBe('the-architect')
    })
  })

  describe('search', () => {
    it('finds entry by member name', async () => {
      const log = new DecisionLog()
      await log.record(fixtureEntry)

      const results = await log.search('the-architect')
      expect(results).toHaveLength(1)
      expect(results[0].matchField).toBe('member')
    })

    it('finds entry by keyword in task or decision', async () => {
      const log = new DecisionLog()
      await log.record(fixtureEntry)

      const results = await log.search('LanceDB')
      expect(results).toHaveLength(1)
      expect(results[0].matchField).toBe('keyword')
    })

    it('filters by member', async () => {
      const log = new DecisionLog()
      await log.record(fixtureEntry)
      await log.record({
        ...fixtureEntry,
        id: 'dec-20260602-002',
        member: 'the-tester',
        task: 'set up test framework',
        decision: 'Use Vitest',
        rationale: 'Vitest is fast and compatible with Vite',
        alternatives: [],
        outcome: 'accepted',
        tags: ['testing'],
      })

      const results = await log.search('test', { member: 'the-tester' })
      expect(results).toHaveLength(1)
      expect(results[0].entry.member).toBe('the-tester')
    })

    it('filters by tags', async () => {
      const log = new DecisionLog()
      await log.record(fixtureEntry)

      const results = await log.search('', { tags: ['memory'] })
      expect(results).toHaveLength(1)

      const noMatch = await log.search('', { tags: ['frontend'] })
      expect(noMatch).toHaveLength(0)
    })

    it('returns empty array when no matches', async () => {
      const log = new DecisionLog()
      await log.record(fixtureEntry)

      const results = await log.search('nonexistent-keyword-xyzz')
      expect(results).toHaveLength(0)
    })
  })

  describe('recent', () => {
    it('returns entries sorted by timestamp descending', async () => {
      const log = new DecisionLog()
      await log.record({ ...fixtureEntry, id: 'dec-001', timestamp: '2026-06-01T00:00:00.000Z' })
      await log.record({ ...fixtureEntry, id: 'dec-002', timestamp: '2026-06-03T00:00:00.000Z' })
      await log.record({ ...fixtureEntry, id: 'dec-003', timestamp: '2026-06-02T00:00:00.000Z' })

      const recent = await log.recent(3)
      expect(recent).toHaveLength(3)
      expect(recent[0].id).toBe('dec-002')
      expect(recent[1].id).toBe('dec-003')
      expect(recent[2].id).toBe('dec-001')
    })

    it('respects count limit', async () => {
      const log = new DecisionLog()
      await log.record({ ...fixtureEntry, id: 'dec-001' })
      await log.record({ ...fixtureEntry, id: 'dec-002' })

      const recent = await log.recent(1)
      expect(recent).toHaveLength(1)
    })
  })
})
