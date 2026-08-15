import { randomUUID } from 'node:crypto'

import type { EvalResult } from '../core/types.ts'
import type { EvalJudge } from './EvalJudge.ts'
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

  constructor(
    private readonly runner: RunMemberFn,
    private readonly judge: EvalJudge,
    options: { metrics?: string[] } = {},
  ) {
    this.metrics = options.metrics ?? []
  }

  async run(suite: EvalSuite, member: string): Promise<EvalReport> {
    const metrics = this.metrics.length > 0 ? this.metrics : (suite.metrics ?? DEFAULT_METRICS)
    const tasks: TaskScore[] = []
    for (const task of suite.tasks) {
      tasks.push(await this.runTask(task, metrics))
    }
    return {
      suiteName: suite.name,
      member,
      timestamp: new Date().toISOString(),
      tasks,
      aggregate: aggregateScores(tasks, metrics),
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
      const status: TaskStatus = Object.keys(scores).length > 0 ? 'completed' : 'unevaluated'
      return { ...base, output, durationMs, scores, status }
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
