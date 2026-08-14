import { cosineSimilarity } from '../utils/cosineSimilarity.js'
import type { TraceEnvelope } from '../core/types.js'
import type { RunMemberFn } from './EvalRunner.js'

export interface ReplayTaskScore {
  correlationId: string
  member: string
  timestamp: string
  status: 'completed' | 'error' | 'skipped'
  storedOutput?: string
  newOutput?: string
  /** Cosine similarity of the stored vs re-run output; null when uncomputable */
  similarity: number | null
  durationMs: number
  error?: string
}

export interface ReplayReport {
  members: string[]
  timestamp: string
  replayCount: number
  skippedCount: number
  errorCount: number
  averageSimilarity: number | null
  tasks: ReplayTaskScore[]
}

export type EmbedFn = (text: string) => Promise<number[]>

/**
 * Re-runs a member against the inputs of historical trace envelopes and
 * compares each re-run output to the stored output, so behavior drift
 * surfaces as a drop in average similarity.
 */
export class ReplayEvaluator {
  constructor(
    private readonly runner: RunMemberFn,
    private readonly embed: EmbedFn,
  ) {}

  async replay(traces: TraceEnvelope[]): Promise<ReplayReport> {
    const tasks: ReplayTaskScore[] = []
    for (const trace of traces) {
      tasks.push(await this.replayTrace(trace))
    }

    const similarities = tasks
      .map((t) => t.similarity)
      .filter((s): s is number => s !== null)
    const averageSimilarity =
      similarities.length > 0 ? similarities.reduce((sum, s) => sum + s, 0) / similarities.length : null

    return {
      members: [...new Set(traces.map((t) => t.member))],
      timestamp: new Date().toISOString(),
      replayCount: traces.length,
      skippedCount: tasks.filter((t) => t.status === 'skipped').length,
      errorCount: tasks.filter((t) => t.status === 'error').length,
      averageSimilarity: averageSimilarity === null ? null : Math.round(averageSimilarity * 10000) / 10000,
      tasks,
    }
  }

  private async replayTrace(trace: TraceEnvelope): Promise<ReplayTaskScore> {
    const base = {
      correlationId: trace.correlationId,
      member: trace.member,
      timestamp: trace.timestamp,
      storedOutput: trace.output,
      durationMs: 0,
    }
    if (!trace.input || !trace.output) {
      return { ...base, status: 'skipped', similarity: null }
    }
    try {
      const { output, durationMs } = await this.runner(trace.input)
      const similarity = await this.embedScore(trace.output, output)
      return { ...base, newOutput: output, durationMs, status: 'completed', similarity }
    } catch (err) {
      return {
        ...base,
        status: 'error',
        similarity: null,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  private async embedScore(stored: string, current: string): Promise<number | null> {
    try {
      const [a, b] = await Promise.all([this.embed(stored), this.embed(current)])
      return cosineSimilarity(a, b)
    } catch {
      return null
    }
  }
}
