import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
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

  it('emits parseable JSON with the chain verdict', async () => {
    const root = workspace()
    writeDecision(root, 'dec-1', '2026-07-01T10:00:00.000Z')
    await track(root, 'prov-1', '2026-07-01T10:00:00.000Z', 'dec-1')

    const raw = await output(['--json'], root)
    const parsed = JSON.parse(raw)

    expect(parsed.events).toHaveLength(2)
    expect(parsed.chain.valid).toBe(true)
    expect(parsed.ok).toBe(true)
    expect(parsed.counts).toEqual({ decisions: 1, provenance: 1, routing: 0 })
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
