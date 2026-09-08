import type { EvalReport, TaskScore } from './EvalRunner.ts'

/** Mean judge score at or above which a non-assertion task counts as passed. */
export const DEFAULT_PASS_THRESHOLD = 0.7

export interface BenchmarkTask {
  input: string
  status: TaskScore['status']
  /** true/false when judgeable, null for errored or unscored tasks. */
  passed: boolean | null
  durationMs: number
  tokens: number
  scores: Record<string, number>
}

export interface Benchmark {
  member: string
  suite: string
  generatedAt: string
  provider?: string
  model?: string
  taskCount: number
  evaluatedCount: number
  errorCount: number
  passRate: number | null
  avgTimeMs: number | null
  avgTokens: number | null
  aggregate: Record<string, number>
  tasks: BenchmarkTask[]
}

/**
 * Whether a task passes: an all-green assertion set wins; otherwise the mean of
 * its judge scores vs the threshold. Null when nothing is judgeable.
 */
export function taskPassed(task: TaskScore, threshold = DEFAULT_PASS_THRESHOLD): boolean | null {
  if (task.status === 'error') return null
  if (task.assertions && task.assertions.total > 0) {
    return task.assertions.passed === task.assertions.total
  }
  const values = Object.values(task.scores)
  if (values.length === 0) return null
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length
  return mean >= threshold
}

function meanOr0(nums: number[]): number {
  return nums.length === 0 ? 0 : nums.reduce((a, b) => a + b, 0) / nums.length
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

/** Folds an EvalReport into a standardized benchmark summary. */
export function buildBenchmark(
  report: EvalReport,
  options: { provider?: string; model?: string; threshold?: number } = {},
): Benchmark {
  const threshold = options.threshold ?? DEFAULT_PASS_THRESHOLD
  const tasks: BenchmarkTask[] = report.tasks.map((t) => ({
    input: t.input,
    status: t.status,
    passed: taskPassed(t, threshold),
    durationMs: t.durationMs,
    tokens: t.tokens,
    scores: t.scores,
  }))

  const evaluated = tasks.filter((t) => t.passed !== null)
  const completed = tasks.filter((t) => t.status === 'completed')
  const passedCount = evaluated.filter((t) => t.passed === true).length

  return {
    member: report.member,
    suite: report.suiteName,
    generatedAt: new Date().toISOString(),
    ...(options.provider ? { provider: options.provider } : {}),
    ...(options.model ? { model: options.model } : {}),
    taskCount: tasks.length,
    evaluatedCount: evaluated.length,
    errorCount: tasks.filter((t) => t.status === 'error').length,
    passRate: evaluated.length === 0 ? null : round4(passedCount / evaluated.length),
    avgTimeMs: completed.length === 0 ? null : Math.round(meanOr0(completed.map((t) => t.durationMs))),
    avgTokens: completed.length === 0 ? null : Math.round(meanOr0(completed.map((t) => t.tokens))),
    aggregate: report.aggregate,
    tasks,
  }
}
