import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { writeRoutingRecord } from '../../../src/commands/route.ts'

function workspace(): string {
  return mkdtempSync(join(tmpdir(), 'agenthood-route-'))
}

const MEMBERS = ['mediator', 'builder', 'scribe']

function record(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    member: 'mediator',
    intent: 'clear-specialist',
    confidence: 94,
    target: 'builder',
    reasoning: 'names the file and the change',
    confidence_factors: ['named file'],
    alternatives_considered: [],
    cascade_applied: false,
    parallel_evaluation: null,
    ...overrides,
  })
}

describe('agenthood route', () => {
  it('writes a valid record and fills id and timestamp', () => {
    const root = workspace()
    const filePath = writeRoutingRecord(record(), root, MEMBERS)

    expect(existsSync(filePath)).toBe(true)
    const written = JSON.parse(readFileSync(filePath, 'utf8'))
    expect(written.id).toMatch(/\S+/)
    expect(written.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(written.target).toBe('builder')
    expect(filePath.startsWith(join(root, '.agenthood', 'routing'))).toBe(true)
  })

  it('preserves an explicit id and timestamp', () => {
    const root = workspace()
    const filePath = writeRoutingRecord(record({ id: 'route-42', timestamp: '2026-07-01T10:00:00.000Z' }), root, MEMBERS)

    expect(filePath.endsWith('route-42.json')).toBe(true)
    expect(JSON.parse(readFileSync(filePath, 'utf8')).timestamp).toBe('2026-07-01T10:00:00.000Z')
  })

  it('rejects invalid JSON and non-objects without writing', () => {
    const root = workspace()

    expect(() => writeRoutingRecord('{"member":', root, MEMBERS)).toThrow(/invalid JSON/)
    expect(() => writeRoutingRecord('[1, 2]', root, MEMBERS)).toThrow(/must be a JSON object/)
    expect(existsSync(join(root, '.agenthood', 'routing'))).toBe(false)
  })

  it('reports every schema violation and writes nothing', () => {
    const root = workspace()
    const bad = record({ target: 'nobody', confidence: 12, cascade_applied: false })

    expect(() => writeRoutingRecord(bad, root, MEMBERS)).toThrow(/target "nobody" is not a registered member/)
    expect(() => writeRoutingRecord(bad, root, MEMBERS)).toThrow(/confidence below 70 requires cascade_applied: true/)
    expect(existsSync(join(root, '.agenthood', 'routing'))).toBe(false)
  })
})
