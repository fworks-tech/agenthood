import { readFileSync } from 'node:fs'
import { join } from 'node:path'

interface BaselineFile {
  aggregate?: Record<string, number>
}

/**
 * Returns the mean of the member's latest eval-baseline aggregates, or null
 * when no baseline exists. Traces are stamped with this so quality-aware
 * consumers (summaries, anomaly detection) have a signal without re-scoring
 * every run.
 */
export function getMemberQualityScore(member: string, baselinesDir: string): number | null {
  try {
    const data = JSON.parse(readFileSync(join(baselinesDir, `${member}.json`), 'utf8')) as BaselineFile
    const values = Object.values(data.aggregate ?? {})
    if (values.length === 0) return null
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    return Math.round(mean * 10000) / 10000
  } catch {
    return null
  }
}
