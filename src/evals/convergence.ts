import type { ConvergenceConfig, ConvergenceResult, EvalRunRecord, RegressionResult } from './types.ts'

export const DEFAULT_CONVERGENCE: ConvergenceConfig = {
  windowSize: 5,
  threshold: 0.02,
  minRuns: 3,
}

export const DEFAULT_REGRESSION_THRESHOLD = 0.1

/** Population variance of a number series; 0 for fewer than 2 values. */
export function computeVariance(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

/**
 * Converged when the variance of pass rates across the most recent
 * `windowSize` runs sits below `threshold` and at least `minRuns` are present.
 */
export function detectConvergence(
  history: EvalRunRecord[],
  config: ConvergenceConfig = DEFAULT_CONVERGENCE,
): ConvergenceResult {
  const recent = history.slice(-config.windowSize)
  const passRates = recent.map((r) => r.passRate)
  const variance = round4(computeVariance(passRates))
  const meanPassRate = passRates.length === 0
    ? 0
    : round4(passRates.reduce((a, b) => a + b, 0) / passRates.length)

  return {
    converged: recent.length >= config.minRuns && variance < config.threshold,
    runsObserved: recent.length,
    variance,
    meanPassRate,
    config,
  }
}

/**
 * Regression when the latest run's pass rate dropped more than `threshold`
 * below the best-seen pass rate in history.
 */
export function detectRegression(
  history: EvalRunRecord[],
  threshold = DEFAULT_REGRESSION_THRESHOLD,
): RegressionResult {
  if (history.length === 0) {
    return { isRegression: false, currentPassRate: 0, bestPassRate: 0, delta: 0, threshold }
  }
  const currentPassRate = history[history.length - 1].passRate
  const bestPassRate = Math.max(...history.map((r) => r.passRate))
  const delta = round4(bestPassRate - currentPassRate)

  return {
    isRegression: delta > threshold,
    currentPassRate,
    bestPassRate,
    delta,
    threshold,
  }
}
