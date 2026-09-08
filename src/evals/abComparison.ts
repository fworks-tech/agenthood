import type { ABTaskScore, SignificanceResult } from './types.ts'

export function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

export function sampleStdDev(values: number[]): number {
  if (values.length < 2) return 0
  const m = mean(values)
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

function normalCDF(x: number): number {
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const p = 0.3275911
  const sign = x < 0 ? -1 : 1
  const ax = Math.abs(x) / Math.sqrt(2)
  const t = 1 / (1 + p * ax)
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax)
  return 0.5 * (1 + sign * y)
}

export function pairedTTest(differences: number[]): { tStatistic: number; pValue: number; df: number } {
  const n = differences.length
  if (n < 2) return { tStatistic: 0, pValue: 1, df: 0 }
  const m = mean(differences)
  const stdErr = sampleStdDev(differences) / Math.sqrt(n)
  const tStatistic = stdErr === 0 ? 0 : m / stdErr
  const df = n - 1
  const corrected = tStatistic * (1 - 1 / (4 * df))
  const pValue = 2 * (1 - normalCDF(Math.abs(corrected)))
  return { tStatistic: round4(tStatistic), pValue: round4(Math.max(0, Math.min(1, pValue))), df }
}

export function cohensD(differences: number[]): number {
  if (differences.length < 2) return 0
  const sd = sampleStdDev(differences)
  return sd === 0 ? 0 : round4(mean(differences) / sd)
}

export function effectLabel(d: number): 'negligible' | 'small' | 'medium' | 'large' {
  const abs = Math.abs(d)
  if (abs < 0.2) return 'negligible'
  if (abs < 0.5) return 'small'
  if (abs < 0.8) return 'medium'
  return 'large'
}

export function aggregateABScores(
  taskScores: ABTaskScore[],
  metrics: string[],
): { aggregateA: Record<string, number>; aggregateB: Record<string, number> } {
  const aggregateA: Record<string, number> = {}
  const aggregateB: Record<string, number> = {}
  for (const metric of metrics) {
    const aScores = taskScores.map((t) => t.scoresA[metric]).filter((s) => s !== undefined)
    const bScores = taskScores.map((t) => t.scoresB[metric]).filter((s) => s !== undefined)
    if (aScores.length > 0) aggregateA[metric] = round4(mean(aScores))
    if (bScores.length > 0) aggregateB[metric] = round4(mean(bScores))
  }
  return { aggregateA, aggregateB }
}

export function determineWinner(
  aggregateA: Record<string, number>,
  aggregateB: Record<string, number>,
  metrics: string[],
): 'A' | 'B' | 'tie' {
  let aWins = 0
  let bWins = 0
  for (const metric of metrics) {
    const a = aggregateA[metric]
    const b = aggregateB[metric]
    if (a === undefined || b === undefined) continue
    if (a > b) aWins++
    else if (b > a) bWins++
  }
  if (aWins > bWins) return 'A'
  if (bWins > aWins) return 'B'
  return 'tie'
}

export function computeSignificance(differences: number[]): SignificanceResult {
  const { tStatistic, pValue, df } = pairedTTest(differences)
  const d = cohensD(differences)
  return {
    tStatistic,
    pValue,
    df,
    significant: pValue < 0.05,
    effectSize: d,
    effectLabel: effectLabel(d),
  }
}
