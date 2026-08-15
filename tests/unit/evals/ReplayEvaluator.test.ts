import { describe, it, expect, vi } from 'vitest'
import { ReplayEvaluator } from '../../../src/evals/ReplayEvaluator.ts'
import type { TraceEnvelope } from '../../../src/core/types.ts'
import type { RunMemberFn } from '../../../src/evals/EvalRunner.ts'

function envelope(overrides: Partial<TraceEnvelope> = {}): TraceEnvelope {
  return {
    member: 'the-reviewer',
    inputHash: 'h-in',
    outputHash: 'h-out',
    durationMs: 10,
    tokenCount: { input: 10, output: 5, total: 15 },
    cost: 0.001,
    qualityScore: null,
    status: 'success',
    correlationId: 'corr-1',
    timestamp: '2026-08-14T00:00:00.000Z',
    source: 'cli',
    input: 'review this',
    output: 'looks good',
    ...overrides,
  }
}

describe('ReplayEvaluator', () => {
  it('re-runs the member against stored inputs and compares outputs', async () => {
    const runner: RunMemberFn = async (task: string) => ({ output: `${task} — approved`, durationMs: 25 })
    const embed = vi.fn(async (text: string) => (text.includes('approved') ? [1, 0] : [0, 1]))
    const report = await new ReplayEvaluator(runner, embed).replay([envelope()])

    expect(report.replayCount).toBe(1)
    expect(report.tasks[0]).toMatchObject({
      correlationId: 'corr-1',
      status: 'completed',
      storedOutput: 'looks good',
      newOutput: 'review this — approved',
      durationMs: 25,
    })
    expect(embed).toHaveBeenCalledWith('looks good')
    expect(embed).toHaveBeenCalledWith('review this — approved')
  })

  it('aggregates similarity across traces', async () => {
    const runner: RunMemberFn = async () => ({ output: 'same output', durationMs: 1 })
    const embed = vi.fn(async () => [1, 0])
    const report = await new ReplayEvaluator(runner, embed).replay([
      envelope({ correlationId: 'a', input: 'x', output: 'same output' }),
      envelope({ correlationId: 'b', input: 'y', output: 'same output' }),
      envelope({ correlationId: 'c', input: 'z', output: 'different output' }),
    ])

    expect(report.averageSimilarity).toBe(1)
    expect(report.tasks).toHaveLength(3)
  })

  it('flags behavior drift as a lower similarity', async () => {
    const runner: RunMemberFn = async () => ({ output: 'new behavior', durationMs: 1 })
    const embed = vi.fn(async (text: string) => (text === 'old behavior' ? [1, 0] : [0, 1]))
    const report = await new ReplayEvaluator(runner, embed).replay([envelope({ output: 'old behavior' })])

    expect(report.tasks[0].similarity).toBe(0)
    expect(report.averageSimilarity).toBe(0)
  })

  it('skips legacy envelopes without raw text', async () => {
    const runner: RunMemberFn = vi.fn(async () => ({ output: 'out', durationMs: 1 }))
    const report = await new ReplayEvaluator(runner, vi.fn(async () => [1])).replay([
      envelope({ input: undefined, output: undefined }),
    ])

    expect(report.tasks[0].status).toBe('skipped')
    expect(report.skippedCount).toBe(1)
    expect(runner).not.toHaveBeenCalled()
  })

  it('marks traces whose re-run fails as errors and continues', async () => {
    const runner: RunMemberFn = async () => {
      throw new Error('provider down')
    }
    const report = await new ReplayEvaluator(runner, vi.fn(async () => [1])).replay([
      envelope({ correlationId: 'a', input: 'x', output: 'y' }),
      envelope({ correlationId: 'b', input: 'u', output: 'v' }),
    ])

    expect(report.errorCount).toBe(2)
    expect(report.tasks[0].status).toBe('error')
    expect(report.tasks[0].error).toBe('provider down')
  })

  it('reports a null average when embedding fails', async () => {
    const runner: RunMemberFn = async () => ({ output: 'out', durationMs: 1 })
    const embed = vi.fn(async () => {
      throw new Error('no embeddings')
    })
    const report = await new ReplayEvaluator(runner, embed).replay([envelope()])

    expect(report.tasks[0].status).toBe('completed')
    expect(report.tasks[0].similarity).toBeNull()
    expect(report.averageSimilarity).toBeNull()
  })

  it('returns an empty report for an empty trace list', async () => {
    const report = await new ReplayEvaluator(vi.fn() as never, vi.fn() as never).replay([])

    expect(report.replayCount).toBe(0)
    expect(report.averageSimilarity).toBeNull()
    expect(report.tasks).toEqual([])
    expect(report.members).toEqual([])
  })

  it('lists the distinct members in the replayed traces', async () => {
    const runner: RunMemberFn = async () => ({ output: 'out', durationMs: 1 })
    const report = await new ReplayEvaluator(runner, vi.fn(async () => [1])).replay([
      envelope({ member: 'the-reviewer', input: 'x', output: 'y' }),
      envelope({ member: 'the-scribe', input: 'u', output: 'v' }),
    ])

    expect(report.members).toEqual(['the-reviewer', 'the-scribe'])
  })
})
