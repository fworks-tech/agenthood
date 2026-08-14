import type { TraceEnvelope } from "./types.ts"

export interface MemberTraceSummary {
  member: string
  callCount: number
  successCount: number
  errorCount: number
  totalCost: number
  avgQuality: number | null
  totalTokens: { input: number; output: number; total: number }
  avgDurationMs: number
}

export interface TraceWindow {
  label: string
  windowMs: number
  summary: MemberTraceSummary | null
}

function summarizeEnvelopes(member: string, envelopes: TraceEnvelope[]): MemberTraceSummary | null {
  if (envelopes.length === 0) return null
  const scored = envelopes.filter((e) => e.qualityScore !== null)
  const totalCost = envelopes.reduce((sum, e) => sum + e.cost, 0)
  return {
    member,
    callCount: envelopes.length,
    successCount: envelopes.filter((e) => e.status === 'success').length,
    errorCount: envelopes.filter((e) => e.status === 'error').length,
    totalCost,
    avgQuality:
      scored.length > 0
        ? scored.reduce((sum, e) => sum + (e.qualityScore as number), 0) / scored.length
        : null,
    totalTokens: {
      input: envelopes.reduce((sum, e) => sum + e.tokenCount.input, 0),
      output: envelopes.reduce((sum, e) => sum + e.tokenCount.output, 0),
      total: envelopes.reduce((sum, e) => sum + e.tokenCount.total, 0),
    },
    avgDurationMs: Math.round(envelopes.reduce((sum, e) => sum + e.durationMs, 0) / envelopes.length),
  }
}

/** Aggregates traces per member. Optionally restricts to a rolling window. */
export function summarizeTraces(traces: TraceEnvelope[], windowMs?: number): MemberTraceSummary[] {
  const cutoff = windowMs !== undefined ? Date.now() - windowMs : undefined
  const filtered = cutoff !== undefined ? traces.filter((e) => new Date(e.timestamp).getTime() >= cutoff) : traces

  const byMember = new Map<string, TraceEnvelope[]>()
  for (const envelope of filtered) {
    const bucket = byMember.get(envelope.member) ?? []
    bucket.push(envelope)
    byMember.set(envelope.member, bucket)
  }

  const summaries: MemberTraceSummary[] = []
  for (const [member, envelopes] of byMember) {
    const summary = summarizeEnvelopes(member, envelopes)
    if (summary) summaries.push(summary)
  }
  return summaries.sort((a, b) => b.totalCost - a.totalCost)
}

/** Summarizes a single member across the standard time windows (1h/24h/7d/all). */
export function summarizeMemberWindows(traces: TraceEnvelope[], member: string): TraceWindow[] {
  const memberTraces = traces.filter((e) => e.member === member)
  const windows: TraceWindow[] = [
    { label: '1h', windowMs: 3_600_000, summary: null },
    { label: '24h', windowMs: 86_400_000, summary: null },
    { label: '7d', windowMs: 604_800_000, summary: null },
    { label: 'all', windowMs: 0, summary: null },
  ]
  return windows.map((w) => ({
    ...w,
    summary: summarizeEnvelopes(
      member,
      w.windowMs > 0
        ? memberTraces.filter((e) => new Date(e.timestamp).getTime() >= Date.now() - w.windowMs)
        : memberTraces,
    ),
  }))
}
