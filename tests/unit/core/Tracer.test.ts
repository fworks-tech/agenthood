import { describe, it, expect } from 'vitest'
import { Tracer } from '../../../src/core/Tracer.js'
import { createTraceEnvelope } from '../../../src/core/TraceEnvelope.js'
import type { TraceEnvelope } from '../../../src/core/types.js'

function makeEnvelope(overrides: Partial<TraceEnvelope> = {}): TraceEnvelope {
  return createTraceEnvelope({
    member: 'the-scribe',
    input: 'write a commit message',
    output: 'feat: add widget',
    durationMs: 123,
    tokenCount: { input: 10, output: 20, total: 30 },
    cost: 0.0001,
    qualityScore: null,
    status: 'success',
    correlationId: 'corr-1',
    ...overrides,
  })
}

describe('Tracer', () => {
  it('records and retrieves traces', () => {
    const tracer = new Tracer(1000)
    tracer.record(makeEnvelope({ member: 'the-scribe' }))
    tracer.record(makeEnvelope({ member: 'the-reviewer', correlationId: 'corr-2' }))

    expect(tracer.getRecent(10)).toHaveLength(2)
  })

  it('returns most recent traces first', () => {
    const tracer = new Tracer(1000)
    tracer.record(makeEnvelope({ member: 'the-scribe' }))
    tracer.record(makeEnvelope({ member: 'the-reviewer' }))

    const recent = tracer.getRecent(2)
    expect(recent[0].member).toBe('the-reviewer')
    expect(recent[1].member).toBe('the-scribe')
  })

  it('filters by member', () => {
    const tracer = new Tracer(1000)
    tracer.record(makeEnvelope({ member: 'the-scribe' }))
    tracer.record(makeEnvelope({ member: 'the-reviewer' }))
    tracer.record(makeEnvelope({ member: 'the-scribe' }))

    expect(tracer.getByMember('the-scribe')).toHaveLength(2)
    expect(tracer.getByMember('the-reviewer')).toHaveLength(1)
    expect(tracer.getByMember('unknown')).toHaveLength(0)
  })

  it('filters by correlation id', () => {
    const tracer = new Tracer(1000)
    tracer.record(makeEnvelope({ correlationId: 'corr-1' }))
    tracer.record(makeEnvelope({ correlationId: 'corr-2' }))
    tracer.record(makeEnvelope({ correlationId: 'corr-1' }))

    expect(tracer.getByCorrelationId('corr-1')).toHaveLength(2)
    expect(tracer.getByCorrelationId('missing')).toHaveLength(0)
  })

  it('ring buffer wraps at capacity and drops oldest', () => {
    const tracer = new Tracer(3)
    tracer.record(makeEnvelope({ member: 'm-1' }))
    tracer.record(makeEnvelope({ member: 'm-2' }))
    tracer.record(makeEnvelope({ member: 'm-3' }))
    tracer.record(makeEnvelope({ member: 'm-4' }))

    const recent = tracer.getRecent(10)
    expect(recent).toHaveLength(3)
    expect(recent.map((e) => e.member)).toEqual(['m-4', 'm-3', 'm-2'])
  })

  it('getRecent respects requested count and clamps at zero', () => {
    const tracer = new Tracer(10)
    tracer.record(makeEnvelope())

    expect(tracer.getRecent(0)).toHaveLength(0)
    expect(tracer.getRecent(-1)).toHaveLength(0)
    expect(tracer.getRecent(1)).toHaveLength(1)
  })

  it('returns empty when nothing recorded', () => {
    const tracer = new Tracer(1000)
    expect(tracer.getRecent(5)).toEqual([])
  })
})
