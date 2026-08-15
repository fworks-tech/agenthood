import { describe, it, expect } from 'vitest'
import { summarizeTraces, summarizeMemberWindows } from '../../../src/core/traceSummary.ts'
import { createTraceEnvelope } from '../../../src/core/TraceEnvelope.ts'
import type { TraceEnvelope } from '../../../src/core/types.ts'

function makeEnvelope(overrides: Partial<TraceEnvelope> = {}): TraceEnvelope {
  return createTraceEnvelope({
    member: 'the-scribe',
    input: 'task',
    output: 'out',
    durationMs: 100,
    tokenCount: { input: 10, output: 5, total: 15 },
    cost: 0.01,
    qualityScore: 0.8,
    status: 'success',
    correlationId: 'corr-1',
    timestamp: new Date().toISOString(),
    ...overrides,
  })
}

describe('summarizeTraces', () => {
  it('aggregates a single member with 10 traces', () => {
    const traces = Array.from({ length: 10 }, (_, i) =>
      makeEnvelope({
        cost: 0.01,
        qualityScore: 0.8,
        durationMs: 100,
        tokenCount: { input: 10, output: 5, total: 15 },
        status: i === 9 ? 'error' : 'success',
      }),
    )

    const [summary] = summarizeTraces(traces)
    expect(summary).toMatchObject({
      member: 'the-scribe',
      callCount: 10,
      successCount: 9,
      errorCount: 1,
      avgDurationMs: 100,
      totalTokens: { input: 100, output: 50, total: 150 },
    })
    expect(summary.totalCost).toBeCloseTo(0.1, 5)
    expect(summary.avgQuality).toBeCloseTo(0.8, 5)
  })

  it('returns null quality when nothing is scored', () => {
    const [summary] = summarizeTraces([makeEnvelope({ qualityScore: null })])
    expect(summary.avgQuality).toBeNull()
  })

  it('groups multiple members and sorts by cost', () => {
    const traces = [
      makeEnvelope({ member: 'the-scribe', cost: 0.02 }),
      makeEnvelope({ member: 'the-reviewer', cost: 0.05 }),
      makeEnvelope({ member: 'the-scribe', cost: 0.01 }),
    ]

    const summaries = summarizeTraces(traces)
    expect(summaries).toHaveLength(2)
    expect(summaries[0].member).toBe('the-reviewer') // highest cost first
    expect(summaries[1].member).toBe('the-scribe')
    expect(summaries[1].callCount).toBe(2)
  })

  it('filters by time window', () => {
    const traces = [
      makeEnvelope({ timestamp: new Date(Date.now() - 600_000).toISOString() }), // 10 min ago
      makeEnvelope({ timestamp: new Date(Date.now() - 3_600_000 * 5).toISOString() }), // 5h ago
    ]

    const lastHour = summarizeTraces(traces, 3_600_000)
    expect(lastHour).toHaveLength(1)
    expect(lastHour[0].callCount).toBe(1)

    const lastDay = summarizeTraces(traces, 86_400_000)
    expect(lastDay).toHaveLength(1)
    expect(lastDay[0].callCount).toBe(2)
  })

  it('returns zero values for an empty window', () => {
    const traces = [makeEnvelope({ timestamp: new Date(Date.now() - 86_400_000 * 30).toISOString() })]
    const summaries = summarizeTraces(traces, 3_600_000)
    expect(summaries).toEqual([])
  })

  it('treats a zero window as all time', () => {
    const traces = [
      makeEnvelope({ timestamp: new Date(Date.now() - 86_400_000 * 30).toISOString() }),
      makeEnvelope(),
    ]
    expect(summarizeTraces(traces, 0)).toHaveLength(1)
    expect(summarizeTraces(traces, 0)[0].callCount).toBe(2)
  })

  it('returns an empty list for no traces', () => {
    expect(summarizeTraces([])).toEqual([])
  })
})

describe('summarizeMemberWindows', () => {
  it('produces the standard window set', () => {
    const traces = [makeEnvelope()]
    const windows = summarizeMemberWindows(traces, 'the-scribe')

    expect(windows.map((w) => w.label)).toEqual(['1h', '24h', '7d', 'all'])
    const all = windows.find((w) => w.label === 'all')
    expect(all?.summary?.callCount).toBe(1)
  })

  it('counts only traces within each window', () => {
    const old = makeEnvelope({ timestamp: new Date(Date.now() - 86_400_000 * 3).toISOString() })
    const fresh = makeEnvelope()
    const windows = summarizeMemberWindows([old, fresh], 'the-scribe')

    const h1 = windows.find((w) => w.label === '1h')
    const d7 = windows.find((w) => w.label === '7d')
    const all = windows.find((w) => w.label === 'all')
    expect(h1?.summary?.callCount).toBe(1)
    expect(d7?.summary?.callCount).toBe(2)
    expect(all?.summary?.callCount).toBe(2)
  })

  it('returns null summaries when the member has no traces', () => {
    const windows = summarizeMemberWindows([makeEnvelope({ member: 'other' })], 'the-scribe')
    for (const w of windows) expect(w.summary).toBeNull()
  })
})
