import { describe, it, expect, vi } from 'vitest'
import { EvalRunner, buildEvalResults, DEFAULT_METRICS } from '../../../src/evals/EvalRunner.js'
import type { EvalJudge, JudgeContext } from '../../../src/evals/EvalJudge.js'
import type { EvalSuite } from '../../../src/evals/types.js'
import type { MemberRunResult, RunMemberFn } from '../../../src/evals/EvalRunner.js'

const suite: EvalSuite = {
  name: 'demo-suite',
  tasks: [
    { input: 'task one', expectedOutput: 'out one' },
    { input: 'task two', expectedOutput: 'out two' },
  ],
}

function stubRunner(output: string, durationMs = 10): { runner: RunMemberFn; inputs: string[] } {
  const inputs: string[] = []
  const runner: RunMemberFn = async (task: string): Promise<MemberRunResult> => {
    inputs.push(task)
    return { output, durationMs }
  }
  return { runner, inputs }
}

function stubJudge(scores: Record<string, number>): EvalJudge {
  return {
    score: vi.fn(async (_metric: string, _ctx: JudgeContext) => scores[_metric] ?? null),
  }
}

describe('EvalRunner', () => {
  it('runs the runner against each task and computes per-task scores', async () => {
    const { runner, inputs } = stubRunner('the answer')
    const judge = stubJudge({ faithfulness: 0.9, relevance: 0.8, context_recall: 0.7, answer_correctness: 0.6 })
    const report = await new EvalRunner(runner, judge).run(suite, 'the-reviewer')

    expect(inputs).toEqual(['task one', 'task two'])
    expect(report.suiteName).toBe('demo-suite')
    expect(report.member).toBe('the-reviewer')
    expect(report.timestamp).toBeTruthy()
    expect(report.tasks).toHaveLength(2)
    for (const task of report.tasks) {
      expect(task.status).toBe('completed')
      expect(task.output).toBe('the answer')
      expect(task.durationMs).toBe(10)
      expect(task.scores).toEqual({ faithfulness: 0.9, relevance: 0.8, context_recall: 0.7, answer_correctness: 0.6 })
    }
  })

  it('aggregates per-metric means across tasks', async () => {
    const { runner } = stubRunner('out')
    const judge: EvalJudge = {
      async score(metric: string) {
        if (metric === 'faithfulness') return 0.5
        return 1
      },
    }
    const report = await new EvalRunner(runner, judge).run(suite, 'member')
    expect(report.aggregate.faithfulness).toBe(0.5)
    expect(report.aggregate.relevance).toBe(1)
  })

  it('handles an empty suite with an empty report', async () => {
    const { runner } = stubRunner('out')
    const report = await new EvalRunner(runner, stubJudge({})).run({ name: 'empty', tasks: [] }, 'member')
    expect(report.tasks).toEqual([])
    expect(report.aggregate).toEqual({})
  })

  it('marks a task as error and continues when the runner fails', async () => {
    const failing: RunMemberFn = async () => {
      throw new Error('boom')
    }
    const report = await new EvalRunner(failing, stubJudge({ faithfulness: 1 })).run(suite, 'member')
    expect(report.tasks).toHaveLength(2)
    for (const task of report.tasks) {
      expect(task.status).toBe('error')
      expect(task.error).toBe('boom')
      expect(task.scores).toEqual({})
    }
    expect(report.aggregate).toEqual({})
  })

  it('marks a task as unevaluated when no metric can be scored', async () => {
    const { runner } = stubRunner('out')
    const report = await new EvalRunner(runner, stubJudge({})).run(suite, 'member')
    for (const task of report.tasks) {
      expect(task.status).toBe('unevaluated')
    }
  })

  it('respects suite-level metric selection', async () => {
    const { runner } = stubRunner('out')
    const judge = stubJudge({ relevance: 0.4 })
    const report = await new EvalRunner(runner, judge).run(
      { name: 'subset', tasks: suite.tasks, metrics: ['relevance'] },
      'member',
    )
    expect(report.tasks[0].scores).toEqual({ relevance: 0.4 })
    expect(report.aggregate).toEqual({ relevance: 0.4 })
  })

  it('respects runner-level metric selection over the suite', async () => {
    const { runner } = stubRunner('out')
    const judge = stubJudge({ faithfulness: 0.6 })
    const report = await new EvalRunner(runner, judge, { metrics: ['faithfulness'] }).run(suite, 'member')
    expect(report.tasks[0].scores).toEqual({ faithfulness: 0.6 })
  })

  it('defaults to the standard four metrics', () => {
    expect(DEFAULT_METRICS).toEqual(['faithfulness', 'relevance', 'context_recall', 'answer_correctness'])
  })
})

describe('buildEvalResults', () => {
  it('converts a report into EvalResult episodes', async () => {
    const { runner } = stubRunner('out')
    const judge = stubJudge({ faithfulness: 0.9 })
    const report = await new EvalRunner(runner, judge).run(suite, 'the-reviewer')
    const results = buildEvalResults(report)

    expect(results).toHaveLength(2)
    for (const result of results) {
      expect(result.episodeId).toMatch(/^eval-/)
      expect(result.scores).toEqual({ faithfulness: 0.9 })
      expect(result.durationMs).toBe(10)
      expect(result.metadata?.member).toBe('the-reviewer')
      expect(result.metadata?.task).toBeTruthy()
    }
  })
})
