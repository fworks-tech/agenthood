import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DecisionSearch } from '../../../src/memory/DecisionSearch.ts'
import { DecisionLog } from '../../../src/memory/DecisionLog.ts'
import type { IVectorStore, VectorRecord } from '../../../src/memory/VectorStore.ts'
import type { Embedder } from '../../../src/memory/DecisionSearch.ts'

class FakeVectorStore implements IVectorStore {
  records: Map<string, VectorRecord> = new Map()

  async connect(): Promise<void> {}
  disconnect(): void {}
  async add(records: VectorRecord[]): Promise<void> {
    for (const r of records) this.records.set(r.id, r)
  }
  async search(_query: number[], topK: number): Promise<Array<{ record: VectorRecord; score: number }>> {
    return Array.from(this.records.values())
      .filter((r) => r.id.startsWith('decision:'))
      .map((record) => ({ record, score: 1 }))
      .slice(0, topK)
  }
  async delete(): Promise<number> {
    return 0
  }
  async stats(): Promise<{ totalVectors: number; dimension: number; totalEntries: number; oldestEntry: Date | null }> {
    return { totalVectors: this.records.size, dimension: 4, totalEntries: this.records.size, oldestEntry: null }
  }
  async getById(id: string): Promise<VectorRecord | null> {
    return this.records.get(id) ?? null
  }
  async getByKeyPrefix(_prefix: string, _limit?: number): Promise<VectorRecord[]> {
    return []
  }
}

const embedder: Embedder = {
  embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3, 0.4]),
}

let dir: string
let log: DecisionLog
let vectorStore: FakeVectorStore

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'agenthood-search-'))
  log = new DecisionLog({ decisionsDir: dir })
  vectorStore = new FakeVectorStore()
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('DecisionSearch', () => {
  describe('indexAll', () => {
    it('indexes every recorded decision', async () => {
      await log.record({
        id: 'dec-001',
        timestamp: '2026-08-11T00:00:00.000Z',
        member: 'the-architect',
        task: 'choose storage',
        decision: 'Use LanceDB',
        rationale: 'embedded',
        alternatives: [],
        outcome: 'accepted',
        tags: ['memory'],
      })
      await log.record({
        id: 'dec-002',
        timestamp: '2026-08-11T00:00:00.000Z',
        member: 'the-tester',
        task: 'choose test runner',
        decision: 'Use Vitest',
        rationale: 'fast',
        alternatives: [],
        outcome: 'accepted',
        tags: ['testing'],
      })

      const search = new DecisionSearch(vectorStore)
      const indexed = await search.indexAll(log, embedder)
      expect(indexed).toBe(2)
      expect(vectorStore.records.has('decision:dec-001')).toBe(true)
      expect(vectorStore.records.has('decision:dec-002')).toBe(true)
    })

    it('skips already indexed decisions', async () => {
      await log.record({
        id: 'dec-001',
        timestamp: '2026-08-11T00:00:00.000Z',
        member: 'the-architect',
        task: 'choose storage',
        decision: 'Use LanceDB',
        rationale: 'embedded',
        alternatives: [],
        outcome: 'accepted',
        tags: ['memory'],
      })

      const search = new DecisionSearch(vectorStore)
      await search.indexAll(log, embedder)
      const secondPass = await search.indexAll(log, embedder)
      expect(secondPass).toBe(0)
    })
  })

  describe('search', () => {
    it('returns matching decisions mapped back to entries', async () => {
      await log.record({
        id: 'dec-001',
        timestamp: '2026-08-11T00:00:00.000Z',
        member: 'the-architect',
        task: 'choose storage',
        decision: 'Use LanceDB',
        rationale: 'embedded',
        alternatives: [],
        outcome: 'accepted',
        tags: ['memory'],
      })

      const search = new DecisionSearch(vectorStore)
      await search.indexAll(log, embedder)
      const hits = await search.search(log, 'storage choice', embedder, 5)

      expect(hits).toHaveLength(1)
      expect(hits[0].entry.id).toBe('dec-001')
      expect(hits[0].score).toBeGreaterThan(0)
    })

    it('returns empty when nothing is indexed', async () => {
      const search = new DecisionSearch(vectorStore)
      const hits = await search.search(log, 'anything', embedder, 5)
      expect(hits).toEqual([])
    })
  })
})
