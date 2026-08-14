import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { JSONFileTraceStore } from '../../../src/core/TraceStore.js'
import { createTraceEnvelope } from '../../../src/core/TraceEnvelope.js'
import type { TraceEnvelope } from '../../../src/core/types.js'

const dirs: string[] = []

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'agenthood-traces-'))
  dirs.push(dir)
  return dir
}

function makeEnvelope(overrides: Partial<TraceEnvelope> = {}): TraceEnvelope {
  return createTraceEnvelope({
    member: 'the-scribe',
    input: 'task',
    output: 'out',
    durationMs: 10,
    tokenCount: { input: 1, output: 1, total: 2 },
    cost: 0.001,
    qualityScore: null,
    status: 'success',
    correlationId: 'corr-1',
    ...overrides,
  })
}

describe('JSONFileTraceStore', () => {
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  })

  it('stores and retrieves N traces', async () => {
    const store = new JSONFileTraceStore(join(tempDir(), 'traces.ndjson'))
    for (let i = 0; i < 5; i++) {
      await store.store(makeEnvelope({ member: `member-${i}` }))
    }

    const all = await store.query()
    expect(all).toHaveLength(5)
  })

  it('queries by member', async () => {
    const store = new JSONFileTraceStore(join(tempDir(), 'traces.ndjson'))
    await store.store(makeEnvelope({ member: 'the-scribe' }))
    await store.store(makeEnvelope({ member: 'the-reviewer' }))
    await store.store(makeEnvelope({ member: 'the-scribe' }))

    const scribes = await store.query({ member: 'the-scribe' })
    expect(scribes).toHaveLength(2)
    expect(scribes.every((e) => e.member === 'the-scribe')).toBe(true)
  })

  it('queries by time range', async () => {
    const store = new JSONFileTraceStore(join(tempDir(), 'traces.ndjson'))
    await store.store(makeEnvelope({ timestamp: '2026-01-01T00:00:00.000Z' }))
    await store.store(makeEnvelope({ timestamp: '2026-06-01T00:00:00.000Z' }))
    await store.store(makeEnvelope({ timestamp: '2026-12-01T00:00:00.000Z' }))

    const middle = await store.query({ since: '2026-05-01T00:00:00.000Z', until: '2026-07-01T00:00:00.000Z' })
    expect(middle).toHaveLength(1)
    expect(middle[0].timestamp).toBe('2026-06-01T00:00:00.000Z')
  })

  it('returns most recent first with limit applied', async () => {
    const store = new JSONFileTraceStore(join(tempDir(), 'traces.ndjson'))
    await store.store(makeEnvelope({ timestamp: '2026-01-01T00:00:00.000Z' }))
    await store.store(makeEnvelope({ timestamp: '2026-02-01T00:00:00.000Z' }))
    await store.store(makeEnvelope({ timestamp: '2026-03-01T00:00:00.000Z' }))

    const limited = await store.query({ limit: 2 })
    expect(limited).toHaveLength(2)
    expect(limited[0].timestamp).toBe('2026-03-01T00:00:00.000Z')
    expect(limited[1].timestamp).toBe('2026-02-01T00:00:00.000Z')
  })

  it('loads persisted traces from disk on construction', async () => {
    const file = join(tempDir(), 'traces.ndjson')
    const first = new JSONFileTraceStore(file)
    await first.store(makeEnvelope({ member: 'the-builder', timestamp: '2026-01-01T00:00:00.000Z' }))
    await first.store(makeEnvelope({ member: 'the-tester', timestamp: '2026-01-01T00:00:01.000Z' }))

    const second = new JSONFileTraceStore(file)
    const all = await second.query()
    expect(all).toHaveLength(2)
    expect(all[0].member).toBe('the-tester')
  })

  it('skips corrupt lines when loading', async () => {
    const file = join(tempDir(), 'traces.ndjson')
    writeFileSync(file, '{not json}\n')
    const store = new JSONFileTraceStore(file)
    await store.store(makeEnvelope())

    const all = await store.query()
    expect(all).toHaveLength(1)
  })

  it('persists valid NDJSON (one JSON object per line)', async () => {
    const file = join(tempDir(), 'traces.ndjson')
    const store = new JSONFileTraceStore(file)
    await store.store(makeEnvelope())
    await store.store(makeEnvelope({ member: 'the-reviewer' }))

    const lines = readFileSync(file, 'utf8').trim().split('\n')
    expect(lines).toHaveLength(2)
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow()
    }
  })
})

describe('resolveTraceStorePath', () => {
  it('defaults to the conventional traces path', async () => {
    const { resolveTraceStorePath } = await import('../../../src/core/TraceStore.js')
    expect(resolveTraceStorePath('/proj', {})).toBe(join('/proj', '.agenthood', 'traces', 'traces.ndjson'))
  })

  it('resolves a relative tracePath against the project root', async () => {
    const { resolveTraceStorePath } = await import('../../../src/core/TraceStore.js')
    const path = resolveTraceStorePath('/proj', { observability: { tracePath: 'var/traces.ndjson' } })
    expect(path).toBe(join('/proj', 'var', 'traces.ndjson'))
  })

  it('keeps an absolute tracePath as-is', async () => {
    const { resolveTraceStorePath } = await import('../../../src/core/TraceStore.js')
    const path = resolveTraceStorePath('/proj', { observability: { tracePath: 'D:/custom/traces.ndjson' } })
    expect(path).toBe('D:/custom/traces.ndjson')
  })

  it('ignores an empty or non-string tracePath', async () => {
    const { resolveTraceStorePath } = await import('../../../src/core/TraceStore.js')
    expect(resolveTraceStorePath('/proj', { observability: { tracePath: '' } })).toBe(join('/proj', '.agenthood', 'traces', 'traces.ndjson'))
    expect(resolveTraceStorePath('/proj', { observability: { tracePath: 42 } })).toBe(join('/proj', '.agenthood', 'traces', 'traces.ndjson'))
  })
})
