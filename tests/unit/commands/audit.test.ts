import { appendFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { audit } from '../../../src/commands/audit.ts'
import { ProvenanceStore } from '../../../src/memory/ProvenanceStore.ts'

function workspace(): string {
  return mkdtempSync(join(tmpdir(), 'agenthood-audit-'))
}

function writeDecision(root: string, id: string, timestamp: string, member = 'scribe'): void {
  const dir = join(root, '.agenthood', 'decisions')
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, `${id}.json`),
    JSON.stringify({
      id,
      timestamp,
      member,
      task: 'task',
      decision: 'done',
      rationale: 'because',
      alternatives: [],
      outcome: 'completed',
      tags: [],
    }),
  )
}

async function track(root: string, entityId: string, timestamp: string, decisionId: string): Promise<void> {
  const store = new ProvenanceStore({ provenanceDir: join(root, '.agenthood', 'provenance') })
  await store.track({
    entityId,
    entityType: 'decision',
    activityId: `run:${decisionId}`,
    agentId: 'scribe',
    timestamp,
    metadata: { decisionId },
  })
}

function stripSequence(root: string, entityId: string): void {
  const file = join(root, '.agenthood', 'provenance', `${entityId}.json`)
  const entry = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
  delete entry.sequenceId
  writeFileSync(file, JSON.stringify(entry))
}

function writeTrace(root: string, correlationId: string, timestamp: string, overrides: Record<string, unknown> = {}): void {
  const dir = join(root, '.agenthood', 'traces')
  mkdirSync(dir, { recursive: true })
  appendFileSync(
    join(dir, 'traces.ndjson'),
    `${JSON.stringify({
      member: 'scribe',
      inputHash: 'in',
      outputHash: 'out',
      durationMs: 2000,
      tokenCount: { input: 100, output: 20, total: 120 },
      cost: 0.0031,
      qualityScore: 1,
      status: 'success',
      correlationId,
      timestamp,
      source: 'cli',
      ...overrides,
    })}\n`,
  )
}

async function output(args: string[], root: string): Promise<string> {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})
  try {
    await audit(args, root)
    return log.mock.calls.flat().join(' ')
  } finally {
    log.mockRestore()
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  process.exitCode = undefined
})

describe('audit command', () => {
  it('orders decisions and provenance by timestamp', async () => {
    const root = workspace()
    writeDecision(root, 'dec-1', '2026-07-01T10:00:00.000Z')
    await track(root, 'prov-1', '2026-07-01T10:00:00.000Z', 'dec-1')
    writeDecision(root, 'dec-2', '2026-07-01T11:00:00.000Z')
    await track(root, 'prov-2', '2026-07-01T11:00:00.000Z', 'dec-2')

    const parsed = JSON.parse(await output(['--json'], root))
    expect(parsed.events.map((event: { id: string }) => event.id)).toEqual(['dec-1', 'prov-1', 'dec-2', 'prov-2'])
    expect(parsed.chain.valid).toBe(true)
    expect(parsed.ok).toBe(true)
    expect(await output([], root)).toContain('trail is complete')
  })

  it('filters by member and since', async () => {
    const root = workspace()
    writeDecision(root, 'dec-1', '2026-07-01T10:00:00.000Z', 'scribe')
    writeDecision(root, 'dec-2', '2026-07-01T11:00:00.000Z', 'builder')

    expect(await output(['--member', 'builder'], root)).toContain('dec-2')
    expect(await output(['--member', 'builder'], root)).not.toContain('dec-1')
    expect(await output(['--since', '2026-07-01T10:30:00.000Z'], root)).not.toContain('dec-1')
  })

  it('reports gaps and exits 1 under --strict', async () => {
    const root = workspace()
    writeDecision(root, 'dec-1', '2026-07-01T10:00:00.000Z')
    await track(root, 'prov-1', '2026-07-01T10:00:01.000Z', 'dec-1')
    writeDecision(root, 'dec-2', '2026-07-01T11:00:00.000Z')

    const text = await output(['--strict'], root)

    expect(text).toContain('decision without provenance: dec-2')
    expect(process.exitCode).toBe(1)
  })

  it('detects a broken chain and does not fail without --strict', async () => {
    const root = workspace()
    await track(root, 'prov-1', '2026-07-01T10:00:00.000Z', 'dec-1')
    const file = join(root, '.agenthood', 'provenance', 'prov-1.json')
    const entry = JSON.parse(readFileSync(file, 'utf8'))
    entry.checksum = 'tampered'
    writeFileSync(file, JSON.stringify(entry))

    expect(await output([], root)).toContain('BROKEN')
    expect(process.exitCode).toBeUndefined()

    await output(['--strict'], root)
    expect(process.exitCode).toBe(1)
  })

  it('fails --strict when an entry keeps its checksum but loses its sequence', async () => {
    const root = workspace()
    writeDecision(root, 'dec-1', '2026-07-01T10:00:00.000Z')
    await track(root, 'prov-1', '2026-07-01T10:00:00.000Z', 'dec-1')
    writeDecision(root, 'dec-2', '2026-07-01T11:00:00.000Z')
    await track(root, 'prov-2', '2026-07-01T11:00:00.000Z', 'dec-2')
    stripSequence(root, 'prov-2')

    const text = await output(['--strict'], root)

    expect(text).toContain('unverified provenance entry: prov-2')
    expect(process.exitCode).toBe(1)
  })

  it('warns about an unverified entry in normal mode without changing the exit code', async () => {
    const root = workspace()
    writeDecision(root, 'dec-1', '2026-07-01T10:00:00.000Z')
    await track(root, 'prov-1', '2026-07-01T10:00:00.000Z', 'dec-1')
    stripSequence(root, 'prov-1')

    const text = await output([], root)

    expect(text).toContain('unverified provenance entry: prov-1')
    expect(process.exitCode).toBeUndefined()
  })

  it('reports a pre-chain legacy entry as unchained and never fails --strict', async () => {
    const root = workspace()
    writeDecision(root, 'legacy-1', '2026-07-01T10:00:00.000Z')
    const dir = join(root, '.agenthood', 'provenance')
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      join(dir, 'legacy-1.json'),
      JSON.stringify({
        entityId: 'legacy-1',
        entityType: 'decision',
        activityId: 'run:legacy-1',
        agentId: 'scribe',
        timestamp: '2026-07-01T10:00:00.000Z',
        metadata: { decisionId: 'legacy-1' },
      }),
    )

    await output(['--strict'], root)
    expect(process.exitCode).toBeUndefined()

    const parsed = JSON.parse(await output(['--json'], root))
    expect(parsed.provenanceStates).toEqual({ chained: 0, unchained: 1, suspect: 0 })
    expect(parsed.unverified).toEqual([])
  })

  it('still exits 0 on a clean trail under --strict', async () => {
    const root = workspace()
    writeDecision(root, 'dec-1', '2026-07-01T10:00:00.000Z')
    await track(root, 'prov-1', '2026-07-01T10:00:00.000Z', 'dec-1')

    await output(['--strict'], root)
    expect(process.exitCode).toBeUndefined()

    const parsed = JSON.parse(await output(['--json'], root))
    expect(parsed.provenanceStates).toEqual({ chained: 1, unchained: 0, suspect: 0 })
  })

  it('classifies a non-numeric sequenceId as suspect, matching the chain coverage that skips it', async () => {
    const root = workspace()
    writeDecision(root, 'dec-1', '2026-07-01T10:00:00.000Z')
    await track(root, 'prov-1', '2026-07-01T10:00:00.000Z', 'dec-1')
    const file = join(root, '.agenthood', 'provenance', 'prov-1.json')
    const entry = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
    entry.sequenceId = '1'
    writeFileSync(file, JSON.stringify(entry))

    const parsed = JSON.parse(await output(['--json'], root))
    expect(parsed.provenanceStates).toEqual({ chained: 0, unchained: 0, suspect: 1 })
    expect(parsed.unverified).toEqual(['prov-1'])

    await output(['--strict'], root)
    expect(process.exitCode).toBe(1)
  })

  it('carries the three provenance counts in JSON output', async () => {
    const root = workspace()
    writeDecision(root, 'dec-1', '2026-07-01T10:00:00.000Z')
    await track(root, 'prov-1', '2026-07-01T10:00:00.000Z', 'dec-1')
    writeDecision(root, 'dec-2', '2026-07-01T11:00:00.000Z')
    await track(root, 'prov-2', '2026-07-01T11:00:00.000Z', 'dec-2')
    writeDecision(root, 'dec-3', '2026-07-01T12:00:00.000Z')
    await track(root, 'prov-3', '2026-07-01T12:00:00.000Z', 'dec-3')
    stripSequence(root, 'prov-3')
    const dir = join(root, '.agenthood', 'provenance')
    writeFileSync(
      join(dir, 'legacy-1.json'),
      JSON.stringify({
        entityId: 'legacy-1',
        entityType: 'decision',
        activityId: 'run:legacy-1',
        agentId: 'scribe',
        timestamp: '2026-07-01T13:00:00.000Z',
        metadata: { decisionId: 'legacy-1' },
      }),
    )
    writeDecision(root, 'legacy-1', '2026-07-01T13:00:00.000Z')

    const parsed = JSON.parse(await output(['--json'], root))
    expect(parsed.provenanceStates).toEqual({ chained: 2, unchained: 1, suspect: 1 })
    expect(parsed.unverified).toEqual(['prov-3'])
    expect(parsed.ok).toBe(false)
  })

  it('emits parseable JSON with the chain verdict', async () => {
    const root = workspace()
    writeDecision(root, 'dec-1', '2026-07-01T10:00:00.000Z')
    await track(root, 'prov-1', '2026-07-01T10:00:00.000Z', 'dec-1')

    const raw = await output(['--json'], root)
    const parsed = JSON.parse(raw)

    expect(parsed.events).toHaveLength(2)
    expect(parsed.chain.valid).toBe(true)
    expect(parsed.ok).toBe(true)
    expect(parsed.counts).toEqual({ decisions: 1, provenance: 1, routing: 0, traces: 0 })
  })

  it('annotates a provenance event with its run metrics', async () => {
    const root = workspace()
    writeDecision(root, 'dec-1', '2026-07-01T10:00:00.000Z')
    await track(root, 'prov-1', '2026-07-01T10:00:00.000Z', 'dec-1')
    writeTrace(root, 'prov-1', '2026-07-01T10:00:01.000Z')

    expect(await output([], root)).toContain('2.0s · $0.0031 · 120 tok')

    const parsed = JSON.parse(await output(['--json'], root))
    expect(parsed.counts.traces).toBe(1)
    expect(parsed.events.find((event: { id: string }) => event.id === 'prov-1').trace).toMatchObject({
      durationMs: 2000,
      cost: 0.0031,
      tokens: 120,
      status: 'success',
    })
    expect(parsed.ok).toBe(true)
  })

  it('ignores log entries in the trace store', async () => {
    const root = workspace()
    writeDecision(root, 'dec-1', '2026-07-01T10:00:00.000Z')
    await track(root, 'prov-1', '2026-07-01T10:00:00.000Z', 'dec-1')
    writeTrace(root, 'prov-1', '2026-07-01T10:00:01.000Z', { entryType: 'log', level: 'info' })

    const parsed = JSON.parse(await output(['--json'], root))
    expect(parsed.counts.traces).toBe(0)
    expect(parsed.events.find((event: { id: string }) => event.id === 'prov-1').trace).toBeUndefined()
  })

  it('reports a corrupt trace line without failing --strict', async () => {
    const root = workspace()
    writeDecision(root, 'dec-1', '2026-07-01T10:00:00.000Z')
    await track(root, 'prov-1', '2026-07-01T10:00:00.000Z', 'dec-1')
    writeTrace(root, 'prov-1', '2026-07-01T10:00:01.000Z')
    appendFileSync(join(root, '.agenthood', 'traces', 'traces.ndjson'), '{"broken":\n')

    expect(await output([], root)).toContain('unreadable trace line 2: invalid JSON')

    const parsed = JSON.parse(await output(['--json'], root))
    expect(parsed.unreadableTraces).toHaveLength(1)
    expect(parsed.ok).toBe(true)
    expect(parsed.counts.traces).toBe(1)

    await output(['--strict'], root)
    expect(process.exitCode).toBeUndefined()
  })

  it('keeps the newest trace when a run has more than one line', async () => {
    const root = workspace()
    writeDecision(root, 'dec-1', '2026-07-01T10:00:00.000Z')
    await track(root, 'prov-1', '2026-07-01T10:00:00.000Z', 'dec-1')
    writeTrace(root, 'prov-1', '2026-07-01T10:00:05.000Z', { durationMs: 5000, cost: 0.9, tokenCount: { input: 900, output: 90, total: 990 } })
    writeTrace(root, 'prov-1', '2026-07-01T10:00:01.000Z', { durationMs: 1000, cost: 0.1, tokenCount: { input: 10, output: 1, total: 11 } })

    const parsed = JSON.parse(await output(['--json'], root))
    expect(parsed.counts.traces).toBe(1)
    expect(parsed.events.find((event: { id: string }) => event.id === 'prov-1').trace).toMatchObject({
      timestamp: '2026-07-01T10:00:05.000Z',
      durationMs: 5000,
      tokens: 990,
    })
  })

  it('accepts a trace line without status', async () => {
    const root = workspace()
    writeDecision(root, 'dec-1', '2026-07-01T10:00:00.000Z')
    await track(root, 'prov-1', '2026-07-01T10:00:00.000Z', 'dec-1')
    writeTrace(root, 'prov-1', '2026-07-01T10:00:01.000Z', { status: undefined, qualityScore: undefined })

    expect(await output([], root)).toContain('2.0s · $0.0031 · 120 tok')

    const parsed = JSON.parse(await output(['--json'], root))
    expect(parsed.events.find((event: { id: string }) => event.id === 'prov-1').trace.status).toBeUndefined()
    expect(parsed.ok).toBe(true)
  })

  it('keeps the later line when duplicate traces share a timestamp', async () => {
    const root = workspace()
    writeDecision(root, 'dec-1', '2026-07-01T10:00:00.000Z')
    await track(root, 'prov-1', '2026-07-01T10:00:00.000Z', 'dec-1')
    writeTrace(root, 'prov-1', '2026-07-01T10:00:01.000Z', { durationMs: 9000, cost: 0.9 })
    writeTrace(root, 'prov-1', '2026-07-01T10:00:01.000Z', { durationMs: 1000, cost: 0.1 })

    const parsed = JSON.parse(await output(['--json'], root))
    expect(parsed.events.find((event: { id: string }) => event.id === 'prov-1').trace).toMatchObject({
      durationMs: 1000,
      cost: 0.1,
    })
  })

  it('reports an unreadable trace store without failing the audit', async () => {
    const root = workspace()
    writeDecision(root, 'dec-1', '2026-07-01T10:00:00.000Z')
    await track(root, 'prov-1', '2026-07-01T10:00:00.000Z', 'dec-1')
    mkdirSync(join(root, '.agenthood', 'traces', 'traces.ndjson'), { recursive: true })

    expect(await output([], root)).toContain('unreadable trace store:')

    const parsed = JSON.parse(await output(['--json'], root))
    expect(parsed.unreadableTraces).toHaveLength(1)
    expect(parsed.ok).toBe(true)

    await output(['--strict'], root)
    expect(process.exitCode).toBeUndefined()
  })

  it('reports an unreadable trail file and exits 1 under --strict', async () => {
    const root = workspace()
    writeDecision(root, 'dec-1', '2026-07-01T10:00:00.000Z')
    await track(root, 'prov-1', '2026-07-01T10:00:00.000Z', 'dec-1')
    writeFileSync(join(root, '.agenthood', 'decisions', 'dec-2.json'), '{"id": "dec-2",')

    expect(await output([], root)).toContain('unreadable trail file decisions/dec-2.json')
    expect(process.exitCode).toBeUndefined()

    const parsed = JSON.parse(await output(['--json'], root))
    expect(parsed.unreadable).toHaveLength(1)
    expect(parsed.unreadable[0]).toContain('decisions/dec-2.json')
    expect(parsed.ok).toBe(false)

    await output(['--strict'], root)
    expect(process.exitCode).toBe(1)
  })

  it('reports a decision file that lacks required fields', async () => {
    const root = workspace()
    mkdirSync(join(root, '.agenthood', 'decisions'), { recursive: true })
    writeFileSync(join(root, '.agenthood', 'decisions', 'dec-1.json'), '{"decision": "no id"}')

    expect(await output([], root)).toContain('unreadable trail file decisions/dec-1.json: missing required fields')
  })

  it('archives the trail on --clear and starts clean', async () => {
    const root = workspace()
    writeDecision(root, 'dec-1', '2026-07-01T10:00:00.000Z')
    await track(root, 'prov-1', '2026-07-01T10:00:00.000Z', 'dec-1')

    expect(await output(['--clear'], root)).toContain('Archived 2 trail entries')

    const archiveRoot = join(root, '.agenthood', 'archive')
    const [stamp] = readdirSync(archiveRoot)
    expect(readdirSync(join(archiveRoot, stamp)).sort()).toEqual(['decisions', 'provenance'])
    expect(existsSync(join(archiveRoot, stamp, 'decisions', 'dec-1.json'))).toBe(true)
    expect(existsSync(join(root, '.agenthood', 'decisions'))).toBe(false)
    expect(await output([], root)).toContain('0 event(s)')
    expect(await output(['--clear'], root)).toContain('already empty')
  })

  it('reports a clear in JSON', async () => {
    const root = workspace()
    writeDecision(root, 'dec-1', '2026-07-01T10:00:00.000Z')

    const parsed = JSON.parse(await output(['--clear', '--json'], root))

    expect(parsed.cleared).toBe(true)
    expect(parsed.archived).toEqual(['decisions'])
  })
})
