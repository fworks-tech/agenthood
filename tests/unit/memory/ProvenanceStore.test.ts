import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ProvenanceStore } from '../../../src/memory/ProvenanceStore.ts'
import type { ProvenanceEntry } from '../../../src/memory/ProvenanceStore.ts'

let dir: string
let store: ProvenanceStore

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'agenthood-prov-'))
  store = new ProvenanceStore({ provenanceDir: dir })
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function entryFor(entityId: string, agentId = 'the-scribe'): Omit<ProvenanceEntry, 'checksum' | 'sequenceId' | 'previousChecksum'> {
  return {
    entityId,
    entityType: 'decision',
    activityId: 'run:the-scribe',
    agentId,
    agentType: 'software_agent',
    role: 'generator',
    sourceDocument: 'write a commit message',
    timestamp: '2026-08-11T00:00:00.000Z',
    confidence: 1,
  }
}

describe('ProvenanceStore', () => {
  describe('track', () => {
    it('assigns sequence ids and writes entry to disk', async () => {
      const first = await store.track(entryFor('exec-1'))
      expect(first.sequenceId).toBe(1)
      expect(first.checksum).toMatch(/^[a-f0-9]{64}$/)
      expect(first.previousChecksum).toBeUndefined()

      const second = await store.track(entryFor('exec-2'))
      expect(second.sequenceId).toBe(2)
      expect(second.previousChecksum).toBe(first.checksum)

      expect(JSON.parse(readFileSync(join(dir, 'exec-1.json'), 'utf8')).entityId).toBe('exec-1')
    })

    it('rejects invalid entity ids', async () => {
      await expect(store.track(entryFor('bad id'))).rejects.toThrow('Invalid provenance entity id')
    })
  })

  describe('get / recent / count', () => {
    it('returns entry by id', async () => {
      await store.track(entryFor('exec-1'))
      const entry = await store.get('exec-1')
      expect(entry?.agentId).toBe('the-scribe')
    })

    it('returns undefined for missing entry', async () => {
      expect(await store.get('exec-missing')).toBeUndefined()
    })

    it('lists recent entries newest first', async () => {
      await store.track(entryFor('exec-1'))
      await store.track(entryFor('exec-2'))
      const recent = await store.recent(2)
      expect(recent.map((e) => e.entityId)).toEqual(['exec-2', 'exec-1'])
      expect(store.count()).toBe(2)
    })
  })

  describe('verifyChain', () => {
    it('validates an untampered chain', async () => {
      await store.track(entryFor('exec-1'))
      await store.track(entryFor('exec-2'))
      await store.track(entryFor('exec-3'))

      const result = await store.verifyChain()
      expect(result.valid).toBe(true)
    })

    it('detects tampering of an existing entry', async () => {
      await store.track(entryFor('exec-1'))
      await store.track(entryFor('exec-2'))

      const path = join(dir, 'exec-1.json')
      const entry = JSON.parse(readFileSync(path, 'utf8')) as ProvenanceEntry
      entry.agentId = 'the-intruder'
      writeFileSync(path, JSON.stringify(entry, null, 2), 'utf8')

      const result = await store.verifyChain()
      expect(result.valid).toBe(false)
      expect(result.brokenAt).toBe('exec-1')
      expect(result.detail).toContain('checksum mismatch')
    })

    it('detects a deleted entry via linkage mismatch', async () => {
      await store.track(entryFor('exec-1'))
      await store.track(entryFor('exec-2'))
      await store.track(entryFor('exec-3'))

      rmSync(join(dir, 'exec-2.json'), { force: true })

      const result = await store.verifyChain()
      expect(result.valid).toBe(false)
      expect(result.brokenAt).toBe('exec-3')
      expect(result.detail).toContain('linkage mismatch')
    })

    it('ignores corrupt files but keeps the chain honest', async () => {
      await store.track(entryFor('exec-1'))
      writeFileSync(join(dir, 'corrupt.json'), '{ not json', 'utf8')

      const result = await store.verifyChain()
      expect(result.valid).toBe(true)
    })
  })

  describe('invalidate', () => {
    it('tombstones an entry without breaking the chain', async () => {
      await store.track(entryFor('exec-1'))
      await store.track(entryFor('exec-2'))

      await store.invalidate('exec-1', 'the-sentinel', 'source retracted')

      const entry = await store.get('exec-1')
      expect(entry?.invalidated).toBe(true)
      expect(entry?.invalidatedBy).toBe('the-sentinel')
      expect(entry?.invalidatedReason).toBe('source retracted')

      const result = await store.verifyChain()
      expect(result.valid).toBe(true)
    })

    it('throws for unknown entity', async () => {
      await expect(store.invalidate('exec-missing', 'the-sentinel', 'nope')).rejects.toThrow('not found')
    })
  })
})
