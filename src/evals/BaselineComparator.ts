import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

import type { EvalReport } from './EvalRunner.ts'

export interface MetricDelta {
  metric: string
  current: number
  baseline: number
  delta: number
}

export interface RegressionReport {
  overall: 'pass' | 'flag'
  regressions: MetricDelta[]
  improvements: MetricDelta[]
  unchanged: MetricDelta[]
  missingMetrics: string[]
}

/** Snapshot of an EvalReport's aggregates, persisted as a comparison target. */
export interface BaselineRecord {
  member: string
  suiteName: string
  timestamp: string
  taskCount: number
  aggregate: Record<string, number>
}

export const DEFAULT_THRESHOLD = 0.1

/**
 * Compares a fresh EvalReport against a stored baseline, flagging metrics
 * whose aggregate dropped by more than the threshold.
 */
export class BaselineComparator {
  constructor(private readonly threshold = DEFAULT_THRESHOLD) {}

  compare(report: EvalReport, baseline: BaselineRecord): RegressionReport {
    const regressions: MetricDelta[] = []
    const improvements: MetricDelta[] = []
    const unchanged: MetricDelta[] = []
    const missingMetrics: string[] = []

    for (const [metric, current] of Object.entries(report.aggregate)) {
      const baselineValue = baseline.aggregate[metric]
      if (baselineValue === undefined) {
        missingMetrics.push(metric)
        continue
      }
      const delta = round4(current - baselineValue)
      const entry = { metric, current, baseline: baselineValue, delta }
      if (delta < -this.threshold) regressions.push(entry)
      else if (delta > this.threshold) improvements.push(entry)
      else unchanged.push(entry)
    }

    for (const metric of Object.keys(baseline.aggregate)) {
      if (report.aggregate[metric] === undefined) missingMetrics.push(metric)
    }

    return {
      overall: regressions.length > 0 ? 'flag' : 'pass',
      regressions,
      improvements,
      unchanged,
      missingMetrics,
    }
  }

  /** Persists the report's aggregates as the new baseline. */
  saveBaseline(report: EvalReport, path: string): BaselineRecord {
    const record: BaselineRecord = {
      member: report.member,
      suiteName: report.suiteName,
      timestamp: report.timestamp,
      taskCount: report.tasks.length,
      aggregate: report.aggregate,
    }
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`, 'utf8')
    return record
  }

  /** Reads a baseline file, or null when missing or unparseable. */
  loadBaseline(path: string): BaselineRecord | null {
    try {
      const data = JSON.parse(readFileSync(path, 'utf8'))
      if (typeof data !== 'object' || data === null) return null
      if (typeof data.member !== 'string' || typeof data.suiteName !== 'string') return null
      if (typeof data.aggregate !== 'object' || data.aggregate === null) return null
      return data as BaselineRecord
    } catch {
      return null
    }
  }
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}
