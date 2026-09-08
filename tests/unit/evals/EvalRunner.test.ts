import { describe, it, expect, vi } from 'vitest'
import { EvalRunner, buildEvalResults, DEFAULT_METRICS } from '../../../src/evals/EvalRunner.ts'
import type { EvalJudge, JudgeContext } from '../../../src/evals/EvalJudge.ts'
import type { EvalSuite } from '../../../src/evals/types.ts'
import type { Assertion } from '../../../src/evals/types.ts'
import type { MemberRunResult, RunMemberFn } from '../../../src/evals/EvalRunner.ts'

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

describe('EvalRunner — assertion grading', () => {
  function assertionSuite(assertions: Assertion[]): EvalSuite {
    return { name: 'assert-suite', metrics: [], tasks: [{ input: 'q', expectedOutput: 'e', assertions }] }
  }

  it('grades deterministic assertions and folds the score into the aggregate', async () => {
    const { runner } = stubRunner('the report is ready')
    const assertions: Assertion[] = [
      { type: 'contains', target: 'report' },
      { type: 'contains', target: 'missing-thing' },
    ]
    const report = await new EvalRunner(runner, stubJudge({})).run(assertionSuite(assertions), 'm')
    expect(report.tasks[0].assertions).toEqual({ score: 0.5, passed: 1, total: 2 })
    expect(report.tasks[0].scores.assertions).toBe(0.5)
    expect(report.tasks[0].status).toBe('completed')
    expect(report.aggregate.assertions).toBe(0.5)
  })

  it('combines assertion and judge metric scores on the same task', async () => {
    const { runner } = stubRunner('x')
    const report = await new EvalRunner(runner, stubJudge({ relevance: 0.8 })).run(
      { name: 's', metrics: ['relevance'], tasks: [{ input: 'q', expectedOutput: 'e', assertions: [{ type: 'exact', target: 'x' }] }] },
      'm',
    )
    expect(report.tasks[0].scores).toEqual({ relevance: 0.8, assertions: 1 })
    expect(report.aggregate).toEqual({ relevance: 0.8, assertions: 1 })
  })

  it('uses the injected embedder for semantic assertions', async () => {
    const { runner } = stubRunner('out-vec')
    const spy = vi.fn(async (text: string) => (text === 'out-vec' ? [1, 0] : [0, 1]))
    const report = await new EvalRunner(runner, stubJudge({}), { embed: spy }).run(
      assertionSuite([{ type: 'semantic', target: 'exp-vec', threshold: 0.5 }]),
      'm',
    )
    // output embeds orthogonal to target -> cos 0 -> fail, score 0
    expect(report.tasks[0].assertions).toMatchObject({ score: 0, passed: 0, total: 1 })
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('a passing semantic assertion yields score ~1', async () => {
    const { runner } = stubRunner('same')
    const embed = async () => [1, 0]
    const report = await new EvalRunner(runner, stubJudge({}), { embed }).run(
      assertionSuite([{ type: 'semantic', target: 'same' }]),
      'm',
    )
    expect(report.tasks[0].assertions).toMatchObject({ score: 1, passed: 1, total: 1 })
  })

  it('tasks without assertions get no assertions key', async () => {
    const { runner } = stubRunner('out')
    const report = await new EvalRunner(runner, stubJudge({ relevance: 0.5 })).run(
      { name: 'noassert', metrics: ['relevance'], tasks: [{ input: 'q', expectedOutput: 'e' }] },
      'm',
    )
    expect(report.tasks[0].assertions).toBeUndefined()
    expect(report.aggregate).toEqual({ relevance: 0.5 })
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
