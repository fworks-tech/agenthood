import { describe, it, expect } from 'vitest'
import { buildBenchmark, taskPassed, DEFAULT_PASS_THRESHOLD } from '../../../src/evals/benchmark.ts'
import type { EvalReport, TaskScore } from '../../../src/evals/EvalRunner.ts'

function task(over: Partial<TaskScore>): TaskScore {
  return {
    input: 'q', expectedOutput: 'e', output: 'o', durationMs: 0, tokens: 0,
    scores: {}, status: 'completed', ...over,
  }
}
function report(tasks: TaskScore[], over: Partial<EvalReport> = {}): EvalReport {
  return { suiteName: 's', member: 'm', timestamp: 'T', tasks, aggregate: {}, ...over }
}

describe('taskPassed', () => {
  it('uses assertion all-pass for tasks with assertions', () => {
    expect(taskPassed(task({ assertions: { score: 1, passed: 2, total: 2 } }))).toBe(true)
    expect(taskPassed(task({ assertions: { score: 0.5, passed: 1, total: 2 } }))).toBe(false)
  })

  it('falls back to the metric mean against the threshold', () => {
    expect(taskPassed(task({ scores: { relevance: 0.8, faithfulness: 0.8 } }))).toBe(true)
    expect(taskPassed(task({ scores: { relevance: 0.69 } }))).toBe(false)
    expect(taskPassed(task({ scores: { relevance: 0.69 } }), 0.6)).toBe(true)
  })

  it('returns null when nothing is judgeable (error or no scores)', () => {
    expect(taskPassed(task({ status: 'error', scores: { relevance: 1 } }))).toBe(null)
    expect(taskPassed(task({ scores: {} }))).toBe(null)
  })

  it('default threshold is 0.7', () => expect(DEFAULT_PASS_THRESHOLD).toBe(0.7))
})

describe('buildBenchmark', () => {
  it('aggregates pass rate, timing and tokens over completed tasks', () => {
    const tasks = [
      task({ status: 'completed', durationMs: 100, tokens: 40, assertions: { score: 1, passed: 1, total: 1 } }),
      task({ status: 'completed', durationMs: 300, tokens: 60, assertions: { score: 0, passed: 0, total: 1 } }),
    ]
    const b = buildBenchmark(report(tasks, { aggregate: { assertions: 0.5 } }))
    expect(b.taskCount).toBe(2)
    expect(b.evaluatedCount).toBe(2)
    expect(b.passRate).toBeCloseTo(0.5, 5)
    expect(b.avgTimeMs).toBe(200)
    expect(b.avgTokens).toBe(50)
    expect(b.aggregate).toEqual({ assertions: 0.5 })
  })

  it('excludes errored tasks from the pass-rate denominator but counts them', () => {
    const tasks = [
      task({ status: 'completed', scores: { relevance: 0.9 }, durationMs: 10, tokens: 5 }),
      task({ status: 'error', error: 'boom' }),
    ]
    const b = buildBenchmark(report(tasks))
    expect(b.errorCount).toBe(1)
    expect(b.evaluatedCount).toBe(1)
    expect(b.passRate).toBe(1)
  })

  it('null pass-rate when nothing is judgeable', () => {
    const b = buildBenchmark(report([task({ status: 'error', error: 'x' })]))
    expect(b.passRate).toBe(null)
    expect(b.evaluatedCount).toBe(0)
  })

  it('tags provider and model when supplied', () => {
    const b = buildBenchmark(report([]), { provider: 'groq', model: 'llama-3.3-70b' })
    expect(b.provider).toBe('groq')
    expect(b.model).toBe('llama-3.3-70b')
  })

  it('per-task outcomes carry passed/tokens/duration', () => {
    const b = buildBenchmark(report([task({ scores: { relevance: 0.9 }, durationMs: 12, tokens: 7 })]))
    expect(b.tasks[0]).toMatchObject({ status: 'completed', passed: true, tokens: 7, durationMs: 12 })
  })
})
