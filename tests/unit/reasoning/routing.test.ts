import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  ROUTING_INTENTS,
  PARALLEL_EVALUATION_THRESHOLD,
  auditRoutingRecords,
  validateRoutingDecision,
  writeRoutingDecision,
} from '../../../src/reasoning/routing.ts'
import type { RoutingDecision } from '../../../src/reasoning/routing.ts'

const MEMBERS = ['the-mediator', 'the-steward', 'the-builder', 'the-strategist']

function decision(overrides: Partial<RoutingDecision> = {}): RoutingDecision {
  return {
    id: 'route-1',
    timestamp: '2026-09-27T03:00:00.000Z',
    member: 'the-mediator',
    intent: 'clear-specialist',
    confidence: 95,
    confidence_factors: ['single specialist lane'],
    target: 'the-builder',
    reasoning: 'Prompt names one implementation task',
    alternatives_considered: [],
    cascade_applied: false,
    parallel_evaluation: null,
    ...overrides,
  }
}

describe('validateRoutingDecision', () => {
  it('accepts a high-confidence direct route', () => {
    expect(validateRoutingDecision(decision(), MEMBERS)).toEqual([])
  })

  it('accepts a sub-threshold route that ran parallel evaluation', () => {
    const ok = decision({
      intent: 'ambiguous',
      confidence: 60,
      cascade_applied: true,
      parallel_evaluation: {
        asked: ['the-strategist', 'the-doorman'],
        responses: [
          { member: 'the-strategist', agrees: true, classification: 'ambiguous' },
          { member: 'the-doorman', agrees: true, classification: 'ambiguous' },
        ],
        outcome: 'consensus',
      },
    })
    expect(validateRoutingDecision(ok, MEMBERS)).toEqual([])
  })

  it('rejects a non-object', () => {
    expect(validateRoutingDecision('nope', MEMBERS)).toEqual(['record is not a JSON object'])
  })

  it('rejects an intent outside the four buckets', () => {
    // The Mediator's own example used "clear-implementation", which is not one
    // of the four buckets its docs define.
    const errors = validateRoutingDecision(decision({ intent: 'clear-implementation' as never }), MEMBERS)
    expect(errors).toContain(`intent must be one of: ${ROUTING_INTENTS.join(', ')}`)
  })

  it.each([101, -1, 4.5, Number.NaN, '90'])('rejects confidence %p', (confidence) => {
    expect(validateRoutingDecision(decision({ confidence: confidence as number }), MEMBERS))
      .toContain('confidence must be an integer 0-100')
  })

  it('accepts both cascade boundaries', () => {
    expect(validateRoutingDecision(decision({ confidence: 70 }), MEMBERS)).toEqual([])
    expect(validateRoutingDecision(decision({ confidence: 0 }), MEMBERS)).not.toContain('confidence must be an integer 0-100')
  })

  it('rejects a target that is not a registered member', () => {
    expect(validateRoutingDecision(decision({ target: 'the-librarian' }), MEMBERS))
      .toContain('target "the-librarian" is not a registered member')
  })

  it('rejects an id that could escape the routing directory', () => {
    expect(validateRoutingDecision(decision({ id: '../evil' }), MEMBERS))
      .toContain('id must match [A-Za-z0-9_-]+ so it can name a file')
  })

  it('rejects a low-confidence decision that skipped the cascade', () => {
    const errors = validateRoutingDecision(decision({ confidence: PARALLEL_EVALUATION_THRESHOLD - 1 }), MEMBERS)
    expect(errors).toContain(`confidence below ${PARALLEL_EVALUATION_THRESHOLD} requires cascade_applied: true`)
    expect(errors).toContain(`confidence below ${PARALLEL_EVALUATION_THRESHOLD} requires a parallel_evaluation or an escalation to The Strategist`)
  })

  it('rejects a parallel evaluation that asked fewer than two members', () => {
    const errors = validateRoutingDecision(decision({
      confidence: 50,
      cascade_applied: true,
      parallel_evaluation: { asked: ['the-strategist'], responses: [], outcome: 'consensus' },
    }), MEMBERS)
    expect(errors).toContain('parallel_evaluation must ask at least two other members')
  })

  it('rejects an unknown parallel evaluation outcome', () => {
    const errors = validateRoutingDecision(decision({
      confidence: 50,
      cascade_applied: true,
      parallel_evaluation: { asked: ['a', 'b'], responses: [], outcome: 'coin-flip' as never },
    }), MEMBERS)
    expect(errors).toContain('parallel_evaluation.outcome must be consensus, disagreement or split')
  })

  it('reports every violation at once so one pass fixes the record', () => {
    const errors = validateRoutingDecision({ id: 'x' }, MEMBERS)
    expect(errors.length).toBeGreaterThan(3)
  })

  it('ignores unknown extra keys rather than dropping the record', () => {
    expect(validateRoutingDecision({ ...decision(), sneaky: 'value' }, MEMBERS)).toEqual([])
  })
})

describe('writeRoutingDecision', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'routing-write-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('writes a valid record the auditor accepts', () => {
    const filePath = writeRoutingDecision(dir, decision(), MEMBERS)
    expect(filePath).toBe(join(dir, 'route-1.json'))
    expect(auditRoutingRecords(dir, MEMBERS)).toEqual([])
  })

  it('creates a missing routing directory', () => {
    const nested = join(dir, 'deep', 'routing')
    writeRoutingDecision(nested, decision(), MEMBERS)
    expect(auditRoutingRecords(nested, MEMBERS)).toEqual([])
  })

  it('refuses an invalid record with every violation listed', () => {
    expect(() => writeRoutingDecision(dir, decision({ target: 'nobody', confidence: 12 }), MEMBERS)).toThrow(
      /not a registered member/,
    )
  })
})

describe('auditRoutingRecords', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'routing-audit-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('passes on a missing directory — a Society that has not routed yet', () => {
    expect(auditRoutingRecords(join(dir, 'nope'), MEMBERS)).toEqual([])
  })

  it('passes when every record is valid', () => {
    writeFileSync(join(dir, 'a.json'), JSON.stringify(decision()))
    expect(auditRoutingRecords(dir, MEMBERS)).toEqual([])
  })

  it('reports the offending file name and its errors', () => {
    writeFileSync(join(dir, 'a.json'), JSON.stringify(decision()))
    writeFileSync(join(dir, 'b.json'), JSON.stringify(decision({ target: 'nobody' })))
    const failures = auditRoutingRecords(dir, MEMBERS)
    expect(failures).toHaveLength(1)
    expect(failures[0].file).toBe('b.json')
    expect(failures[0].errors).toContain('target "nobody" is not a registered member')
  })

  it('reports unparseable JSON instead of throwing', () => {
    writeFileSync(join(dir, 'broken.json'), '{ not json')
    const failures = auditRoutingRecords(dir, MEMBERS)
    expect(failures).toHaveLength(1)
    expect(failures[0].errors[0]).toMatch(/^unreadable JSON: /)
  })

  it('ignores edges.json-style non-record files by extension only', () => {
    mkdirSync(join(dir, 'sub'))
    writeFileSync(join(dir, 'notes.txt'), 'ignore me')
    expect(auditRoutingRecords(dir, MEMBERS)).toEqual([])
  })
})
