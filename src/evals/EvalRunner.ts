import { randomUUID } from 'node:crypto'

import type { EvalResult } from '../core/types.ts'
import { gradeAssertions } from './AssertionJudge.ts'
import type { EvalJudge } from './EvalJudge.ts'
import type { EmbedFn } from './ReplayEvaluator.ts'
import type { EvalSuite, EvalTask } from './types.ts'

export const DEFAULT_METRICS = ['faithfulness', 'relevance', 'context_recall', 'answer_correctness']

export interface MemberRunResult {
  output: string
  durationMs: number
}

export type RunMemberFn = (task: string) => Promise<MemberRunResult>

export type TaskStatus = 'completed' | 'error' | 'unevaluated'

export interface TaskScore {
  input: string
  expectedOutput: string
  output: string
  durationMs: number
  scores: Record<string, number>
  status: TaskStatus
  error?: string
  assertions?: { score: number; passed: number; total: number }
}

export interface EvalReport {
  suiteName: string
  member: string
  timestamp: string
  tasks: TaskScore[]
  aggregate: Record<string, number>
}

/**
 * Runs a member against every task in a suite, scores each run through an
 * EvalJudge, and aggregates per-metric means. `runner` is injected so tests
 * and the replay evaluator can drive it without an LLM.
 */
export class EvalRunner {
  private readonly metrics: string[]
  private readonly embed?: EmbedFn

  constructor(
    private readonly runner: RunMemberFn,
    private readonly judge: EvalJudge,
    options: { metrics?: string[]; embed?: EmbedFn } = {},
  ) {
    this.metrics = options.metrics ?? []
    this.embed = options.embed
  }

  async run(suite: EvalSuite, member: string): Promise<EvalReport> {
    const metrics = this.metrics.length > 0 ? this.metrics : (suite.metrics ?? DEFAULT_METRICS)
    const tasks: TaskScore[] = []
    for (const task of suite.tasks) {
      tasks.push(await this.runTask(task, metrics))
    }
    // Fold the deterministic assertion score into the aggregate when any task asserts.
    const aggMetrics =
      metrics.includes('assertions') || suite.tasks.some((t) => t.assertions?.length)
        ? [...metrics, 'assertions']
        : metrics
    return {
      suiteName: suite.name,
      member,
      timestamp: new Date().toISOString(),
      tasks,
      aggregate: aggregateScores(tasks, aggMetrics),
    }
  }

  private async runTask(task: EvalTask, metrics: string[]): Promise<TaskScore> {
    const base = { input: task.input, expectedOutput: task.expectedOutput, output: '', durationMs: 0, scores: {} }
    try {
      const { output, durationMs } = await this.runner(task.input)
      const scores: Record<string, number> = {}
      for (const metric of metrics) {
        const score = await this.judge.score(metric, { input: task.input, output, expected: task.expectedOutput })
        if (score !== null) scores[metric] = score
      }
      let assertions: TaskScore['assertions']
      if (task.assertions?.length) {
        const grade = await gradeAssertions(task.assertions, output, this.embed)
        assertions = { score: grade.score, passed: grade.passed, total: grade.total }
        scores.assertions = grade.score
      }
      const status: TaskStatus = Object.keys(scores).length > 0 ? 'completed' : 'unevaluated'
      return { ...base, output, durationMs, scores, status, assertions }
    } catch (err) {
      return { ...base, status: 'error', error: err instanceof Error ? err.message : String(err) }
    }
  }
}

function aggregateScores(tasks: TaskScore[], metrics: string[]): Record<string, number> {
  const aggregate: Record<string, number> = {}
  for (const metric of metrics) {
    const scored = tasks.filter((t) => t.scores[metric] !== undefined)
    if (scored.length === 0) continue
    const mean = scored.reduce((sum, t) => sum + t.scores[metric], 0) / scored.length
    aggregate[metric] = Math.round(mean * 10000) / 10000
  }
  return aggregate
}

/** Converts a report into EvalResult episodes consumable by the EpisodeLearner. */
export function buildEvalResults(report: EvalReport): EvalResult[] {
  return report.tasks.map((task) => ({
    episodeId: `eval-${randomUUID()}`,
    scores: task.scores,
    durationMs: task.durationMs,
    metadata: { member: report.member, task: task.input },
  }))
}
