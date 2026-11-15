import { describe, it, expect } from 'vitest'
import { summarizeMemberWindows } from '../../../src/commands/status.ts'
import { createTraceEnvelope } from '../../../src/core/TraceEnvelope.ts'
import type { TraceEnvelope } from '../../../src/core/types.ts'

function makeEnvelope(overrides: Partial<TraceEnvelope> = {}): TraceEnvelope {
  return createTraceEnvelope({
    member: 'scribe',
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

describe('summarizeMemberWindows', () => {
  it('produces the standard window set', () => {
    const traces = [makeEnvelope()]
    const windows = summarizeMemberWindows(traces, 'scribe')

    expect(windows.map((w) => w.label)).toEqual(['1h', '24h', '7d', 'all'])
    const all = windows.find((w) => w.label === 'all')
    expect(all?.summary?.callCount).toBe(1)
  })

  it('counts only traces within each window', () => {
    const old = makeEnvelope({ timestamp: new Date(Date.now() - 86_400_000 * 3).toISOString() })
    const fresh = makeEnvelope()
    const windows = summarizeMemberWindows([old, fresh], 'scribe')

    const h1 = windows.find((w) => w.label === '1h')
    const d7 = windows.find((w) => w.label === '7d')
    const all = windows.find((w) => w.label === 'all')
    expect(h1?.summary?.callCount).toBe(1)
    expect(d7?.summary?.callCount).toBe(2)
    expect(all?.summary?.callCount).toBe(2)
  })

  it('returns null summaries when the member has no traces', () => {
    const windows = summarizeMemberWindows([makeEnvelope({ member: 'other' })], 'scribe')
    for (const w of windows) expect(w.summary).toBeNull()
  })
})
