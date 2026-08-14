import { describe, it, expect, vi } from 'vitest'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  JSONFileTraceStore,
  RetentionManager,
  createRetentionPolicyFromConfig,
} from '../../../src/core/TraceStore.js'
import { createTraceEnvelope } from '../../../src/core/TraceEnvelope.js'
import type { TraceEnvelope } from '../../../src/core/types.js'

function envelope(member: string, timestamp: string): TraceEnvelope {
  return createTraceEnvelope({
    member,
    input: 'task',
    output: 'out',
    durationMs: 1,
    tokenCount: { input: 1, output: 1, total: 2 },
    cost: 0.001,
    qualityScore: null,
    status: 'success',
    correlationId: `corr-${timestamp}`,
    timestamp,
  })
}

const now = Date.now()
const old = (minutesAgo: number): string => new Date(now - minutesAgo * 60_000).toISOString()

describe('JSONFileTraceStore.prune', () => {
  it('removes traces older than the TTL', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'agenthood-retention-'))
    const file = join(dir, 'traces.ndjson')
    try {
      const store = new JSONFileTraceStore(file)
      await store.store(envelope('a', old(120)))
      await store.store(envelope('b', old(10)))
      await store.store(envelope('c', old(5)))

      const result = await store.prune({ ttlMs: 60 * 60_000 })
      expect(result.pruned).toBe(1)
      expect(result.remaining).toBe(2)
      const traces = await store.query()
      expect(traces.map((t) => t.member).sort()).toEqual(['b', 'c'])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('prunes oldest first when over the entry cap', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'agenthood-retention-'))
    const file = join(dir, 'traces.ndjson')
    try {
      const store = new JSONFileTraceStore(file)
      await store.store(envelope('a', old(30)))
      await store.store(envelope('b', old(20)))
      await store.store(envelope('c', old(10)))

      const result = await store.prune({ ttlMs: 0, maxEntries: 2 })
      expect(result.pruned).toBe(1)
      const traces = await store.query()
      expect(traces.map((t) => t.member).sort()).toEqual(['b', 'c'])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('exports pruned traces to NDJSON before deletion', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'agenthood-retention-'))
    const file = join(dir, 'traces.ndjson')
    const exportFile = join(dir, 'export', 'pruned.ndjson')
    try {
      const store = new JSONFileTraceStore(file)
      await store.store(envelope('a', old(120)))
      await store.store(envelope('b', old(10)))

      const result = await store.prune({ ttlMs: 60 * 60_000, exportEnabled: true, exportPath: exportFile })
      expect(result.exported).toBe(1)
      expect(result.exportPath).toBe(exportFile)

      const lines = readFileSync(exportFile, 'utf8').trim().split('\n')
      expect(lines).toHaveLength(1)
      expect(JSON.parse(lines[0]).member).toBe('a')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('persists the compacted file on disk', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'agenthood-retention-'))
    const file = join(dir, 'traces.ndjson')
    try {
      const store = new JSONFileTraceStore(file)
      await store.store(envelope('a', old(120)))
      await store.store(envelope('b', old(5)))
      await store.prune({ ttlMs: 60 * 60_000 })

      const reloaded = new JSONFileTraceStore(file)
      const traces = await reloaded.query()
      expect(traces).toHaveLength(1)
      expect(traces[0].member).toBe('b')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('never prunes when ttlMs is 0', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'agenthood-retention-'))
    const file = join(dir, 'traces.ndjson')
    try {
      const store = new JSONFileTraceStore(file)
      await store.store(envelope('a', old(4000)))
      const result = await store.prune({ ttlMs: 0 })
      expect(result.pruned).toBe(0)
      expect((await store.query()).length).toBe(1)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('RetentionManager', () => {
  it('prunes on demand', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'agenthood-retention-'))
    const file = join(dir, 'traces.ndjson')
    try {
      const store = new JSONFileTraceStore(file)
      await store.store(envelope('a', old(120)))
      const manager = new RetentionManager(store, { ttlMs: 60_000 })
      const result = await manager.prune()
      expect(result.pruned).toBe(1)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('start schedules pruning on the interval and stop clears it', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'agenthood-retention-'))
    const file = join(dir, 'traces.ndjson')
    try {
      const store = new JSONFileTraceStore(file)
      await store.store(envelope('a', old(120)))
      const pruneSpy = vi.spyOn(store, 'prune')
      const manager = new RetentionManager(store, { ttlMs: 60_000 }, 10)
      manager.start()
      await vi.waitFor(() => expect(pruneSpy).toHaveBeenCalled())
      manager.stop()
      const calls = pruneSpy.mock.calls.length
      await new Promise((resolve) => setTimeout(resolve, 30))
      expect(pruneSpy.mock.calls.length).toBe(calls)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('createRetentionPolicyFromConfig', () => {
  it('returns undefined without an observability.retention block', () => {
    expect(createRetentionPolicyFromConfig({})).toBeUndefined()
    expect(createRetentionPolicyFromConfig(undefined)).toBeUndefined()
  })

  it('maps ttlDays, maxEntries, and export options', () => {
    const policy = createRetentionPolicyFromConfig({
      observability: { retention: { ttlDays: 30, maxEntries: 100, exportEnabled: true, exportPath: './traces/export' } },
    })
    expect(policy?.ttlMs).toBe(30 * 86_400_000)
    expect(policy?.maxEntries).toBe(100)
    expect(policy?.exportEnabled).toBe(true)
    expect(policy?.exportPath).toBe('./traces/export')
  })

  it('defaults to a never-prune policy when ttlDays is absent', () => {
    const policy = createRetentionPolicyFromConfig({ observability: { retention: { exportEnabled: true } } })
    expect(policy?.ttlMs).toBe(0)
  })
})
