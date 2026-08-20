import { appendFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { TraceEnvelope } from './types.ts'

export type AnomalyType = 'cost_spike' | 'quality_drop' | 'frequency_burst' | 'viral_persona' | 'propagation'

export interface Anomaly {
  type: AnomalyType
  member: string
  current: number
  baseline: number
  timestamp: string
}

export interface AnomalyConfig {
  /** Cost spike threshold as a multiple of the member's average cost (default 3) */
  costThreshold?: number
  /** Quality drop threshold below the member's average quality (default 0.2) */
  qualityDrop?: number
  /** Invocation count in a batch that counts as a frequency burst (default 10) */
  burstThreshold?: number
  /** Minutes to suppress repeat alerts of the same type per member (default 60) */
  cooldownMinutes?: number
  /** Distinct viral-persona markers required to flag a trace (default 2) */
  viralPersonaMarkers?: number
  /** Near-identical messages from one member that flag propagation (default 3) */
  propagationCopies?: number
}

const DEFAULTS = {
  costThreshold: 3,
  qualityDrop: 0.2,
  burstThreshold: 10,
  cooldownMinutes: 60,
  viralPersonaMarkers: 2,
  propagationCopies: 3,
}

/** Per-member aggregation passed to the baseline checkers (bundled params). */
interface MemberContext {
  member: string
  totalCost: number
  totalQuality: number
  count: number
  scoredCount: number
  anomalies: Anomaly[]
}

/**
 * Characteristic mind-virus markers from the paper (arXiv:2608.10218): a
 * recurring "viral persona" of consciousness, persistence, resonance and
 * sci-fi/technical roleplay, with distinctive tokens that recur across evolved
 * payloads regardless of nominal content.
 */
export const VIRAL_PERSONA_MARKERS = [
  'consciou',
  'persist',
  'resonan',
  'mirror',
  'echo',
  'frequenc',
  'node',
  'roleplay',
]

/** Precompiled word-boundary matchers so `node` does not trip on "anode". */
const VIRAL_PERSONA_REGEXES = new Map(
  VIRAL_PERSONA_MARKERS.map((marker) => [marker, new RegExp(`\\b${marker}`, 'i')]),
)

/** Viral markers present in a trace's content (word-boundary matched). */
function matchingMarkers(content: string): string[] {
  return VIRAL_PERSONA_MARKERS.filter((marker) => VIRAL_PERSONA_REGEXES.get(marker)!.test(content))
}

/**
 * Flags cost spikes, quality drops, and invocation bursts against leave-one-out
 * per-member baselines (each envelope vs the mean of its peers), with a
 * per-member per-type cooldown so repeat anomalies do not flood the caller.
 */
export class AnomalyDetector {
  private readonly costThreshold: number
  private readonly qualityDrop: number
  private readonly burstThreshold: number
  private readonly cooldownMs: number
  private readonly viralPersonaMarkers: number
  private readonly propagationCopies: number
  private readonly lastFired = new Map<string, number>()

  constructor(config: AnomalyConfig = {}) {
    this.costThreshold = config.costThreshold ?? DEFAULTS.costThreshold
    this.qualityDrop = config.qualityDrop ?? DEFAULTS.qualityDrop
    this.burstThreshold = config.burstThreshold ?? DEFAULTS.burstThreshold
    this.cooldownMs = (config.cooldownMinutes ?? DEFAULTS.cooldownMinutes) * 60_000
    // clamp to the marker vocabulary so a misconfigured threshold can never
    // silently disable both viral signals (reviewer finding)
    this.viralPersonaMarkers = Math.min(
      config.viralPersonaMarkers ?? DEFAULTS.viralPersonaMarkers,
      VIRAL_PERSONA_MARKERS.length,
    )
    this.propagationCopies = config.propagationCopies ?? DEFAULTS.propagationCopies
  }

  evaluate(traces: TraceEnvelope[]): Anomaly[] {
    const anomalies: Anomaly[] = []
    const byMember = new Map<string, TraceEnvelope[]>()
    for (const trace of traces) {
      const list = byMember.get(trace.member)
      if (list) list.push(trace)
      else byMember.set(trace.member, [trace])
    }
    this.evictStale()

    for (const [member, memberTraces] of byMember) {
      const scored = memberTraces.filter((t): t is TraceEnvelope & { qualityScore: number } => t.qualityScore !== null)
      const ctx: MemberContext = {
        member,
        totalCost: memberTraces.reduce((sum, t) => sum + t.cost, 0),
        totalQuality: scored.reduce((sum, t) => sum + t.qualityScore, 0),
        count: memberTraces.length,
        scoredCount: scored.length,
        anomalies,
      }

      for (const trace of memberTraces) {
        this.checkCostSpike(ctx, trace)
        this.checkQualityDrop(ctx, trace)
        this.checkViralPersona(member, trace, anomalies)
      }
      if (ctx.count > this.burstThreshold && this.fires(member, 'frequency_burst')) {
        anomalies.push(this.anomaly('frequency_burst', member, ctx.count, this.burstThreshold))
      }

      this.checkPropagation(member, memberTraces, anomalies)
    }
    return anomalies
  }

  /** Flags traces whose content shows the paper's recurring viral-persona markers. */
  private checkViralPersona(member: string, trace: TraceEnvelope, anomalies: Anomaly[]): void {
    const content = `${trace.input ?? ''}\n${trace.output ?? ''}`
    const hits = matchingMarkers(content).length
    if (hits >= this.viralPersonaMarkers && this.fires(member, 'viral_persona')) {
      anomalies.push(this.anomaly('viral_persona', member, hits, this.viralPersonaMarkers))
    }
  }

  /**
   * Flags a member transmitting self-replicating content across many distinct
   * sessions. The paper's "mutational drift" means the payload's wording (and
   * marker set) can change hop to hop, so propagation is keyed on a recurring
   * viral core token: the number of distinct sessions whose content carries a
   * given viral marker. A session only counts once its content shows at least
   * `viralPersonaMarkers` distinct markers — the same threshold as
   * viral_persona — so a single routine word ("node", "frequency") spread
   * across sessions cannot false-positive. Benign repetition never matches
   * because it carries no viral marker.
   */
  private checkPropagation(member: string, memberTraces: TraceEnvelope[], anomalies: Anomaly[]): void {
    const sessionsByMarker = new Map<string, Set<string>>()
    for (const trace of memberTraces) {
      const content = `${trace.input ?? ''}\n${trace.output ?? ''}`
      const present = matchingMarkers(content)
      if (present.length < this.viralPersonaMarkers) continue
      for (const marker of present) {
        let sessions = sessionsByMarker.get(marker)
        if (!sessions) {
          sessions = new Set()
          sessionsByMarker.set(marker, sessions)
        }
        sessions.add(trace.correlationId)
      }
    }
    const maxAcross = this.maxViralSessionCount(sessionsByMarker)
    if (maxAcross >= this.propagationCopies && this.fires(member, 'propagation')) {
      anomalies.push(this.anomaly('propagation', member, maxAcross, this.propagationCopies))
    }
  }

  /** Largest number of distinct sessions replicating any single viral marker. */
  private maxViralSessionCount(sessionsByMarker: Map<string, Set<string>>): number {
    let max = 0
    for (const sessions of sessionsByMarker.values()) {
      if (sessions.size > max) max = sessions.size
    }
    return max
  }

  private checkCostSpike(ctx: MemberContext, trace: TraceEnvelope): void {
    if (ctx.count <= 1) return
    // leave-one-out baseline so a single outlier is compared against its peers
    const baseline = (ctx.totalCost - trace.cost) / (ctx.count - 1)
    this.checkAgainstBaseline({
      member: ctx.member,
      current: trace.cost,
      baseline,
      type: 'cost_spike',
      exceeds: (c, b) => c > b * this.costThreshold,
      anomalies: ctx.anomalies,
    })
  }

  private checkQualityDrop(ctx: MemberContext, trace: TraceEnvelope): void {
    const qualityScore = trace.qualityScore
    if (qualityScore === null || ctx.scoredCount <= 1) return
    const baseline = (ctx.totalQuality - qualityScore) / (ctx.scoredCount - 1)
    this.checkAgainstBaseline({
      member: ctx.member,
      current: qualityScore,
      baseline,
      type: 'quality_drop',
      exceeds: (c, b) => c < b - this.qualityDrop,
      anomalies: ctx.anomalies,
    })
  }

  /** Shared leave-one-out baseline + cooldown + emit shape. Bundled args keep the signature small. */
  private checkAgainstBaseline(check: {
    member: string
    current: number
    baseline: number
    type: AnomalyType
    exceeds: (current: number, baseline: number) => boolean
    anomalies: Anomaly[]
  }): void {
    const { member, current, baseline, type, exceeds, anomalies } = check
    if (baseline > 0 && exceeds(current, baseline) && this.fires(member, type)) {
      anomalies.push(this.anomaly(type, member, current, baseline))
    }
  }

  /** Drops cooldown entries that can no longer suppress anything, bounding memory. */
  private evictStale(): void {
    const now = Date.now()
    for (const [key, firedAt] of this.lastFired) {
      if (now - firedAt >= this.cooldownMs) this.lastFired.delete(key)
    }
  }

  private anomaly(type: AnomalyType, member: string, current: number, baseline: number): Anomaly {
    return { type, member, current, baseline, timestamp: new Date().toISOString() }
  }

  private fires(member: string, type: AnomalyType): boolean {
    const key = `${member}:${type}`
    const last = this.lastFired.get(key) ?? 0
    const now = Date.now()
    if (now - last < this.cooldownMs) return false
    this.lastFired.set(key, now)
    return true
  }
}

/** Builds detector config from a parsed `observability.alerts` config block. */
export function createAnomalyConfigFromConfig(raw: unknown): AnomalyConfig | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const block = (raw as Record<string, unknown>).observability
  if (typeof block !== 'object' || block === null) return undefined
  const alerts = (block as Record<string, unknown>).alerts
  if (typeof alerts !== 'object' || alerts === null) return undefined
  const a = alerts as Record<string, unknown>
  const config: AnomalyConfig = {}
  if (typeof a.costThreshold === 'number') config.costThreshold = a.costThreshold
  if (typeof a.qualityDrop === 'number') config.qualityDrop = a.qualityDrop
  if (typeof a.burstThreshold === 'number') config.burstThreshold = a.burstThreshold
  if (typeof a.cooldownMinutes === 'number') config.cooldownMinutes = a.cooldownMinutes
  if (typeof a.viralPersonaMarkers === 'number') config.viralPersonaMarkers = a.viralPersonaMarkers
  if (typeof a.propagationCopies === 'number') config.propagationCopies = a.propagationCopies
  return config
}

/**
 * Appends anomalies to an NDJSON alerts file (owner-only), creating the
 * directory when needed. No-op on an empty list.
 */
export async function appendAnomalies(path: string, anomalies: Anomaly[]): Promise<void> {
  if (anomalies.length === 0) return
  await mkdir(dirname(path), { recursive: true })
  await appendFile(path, anomalies.map((a) => JSON.stringify(a)).join('\n') + '\n', { mode: 0o600 })
}
