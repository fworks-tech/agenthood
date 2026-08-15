import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BaselineComparator } from '../../../src/evals/BaselineComparator.ts'
import type { EvalReport } from '../../../src/evals/EvalRunner.ts'

function report(aggregate: Record<string, number>): EvalReport {
  return {
    suiteName: 'demo-suite',
    member: 'the-reviewer',
    timestamp: '2026-08-14T00:00:00.000Z',
    tasks: [],
    aggregate,
  }
}

const baseline = {
  member: 'the-reviewer',
  suiteName: 'demo-suite',
  timestamp: '2026-08-13T00:00:00.000Z',
  taskCount: 2,
  aggregate: { faithfulness: 0.8, relevance: 0.7, answer_correctness: 0.5 },
}

describe('BaselineComparator', () => {
  it('passes when all metrics are within the threshold', () => {
    const result = new BaselineComparator().compare(
      report({ faithfulness: 0.8, relevance: 0.7, answer_correctness: 0.5 }),
      baseline,
    )
    expect(result.overall).toBe('pass')
    expect(result.regressions).toEqual([])
    expect(result.unchanged.map((d) => d.metric).sort()).toEqual([
      'answer_correctness',
      'faithfulness',
      'relevance',
    ])
  })

  it('flags a metric that dropped below the threshold', () => {
    const result = new BaselineComparator().compare(
      report({ faithfulness: 0.8, relevance: 0.5, answer_correctness: 0.5 }),
      baseline,
    )
    expect(result.overall).toBe('flag')
    expect(result.regressions).toEqual([
      { metric: 'relevance', current: 0.5, baseline: 0.7, delta: -0.2 },
    ])
  })

  it('does not flag drops within the threshold', () => {
    const result = new BaselineComparator().compare(
      report({ faithfulness: 0.72, relevance: 0.7, answer_correctness: 0.5 }),
      baseline,
    )
    expect(result.overall).toBe('pass')
    expect(result.regressions).toEqual([])
  })

  it('reports improvements', () => {
    const result = new BaselineComparator().compare(
      report({ faithfulness: 0.95, relevance: 0.7, answer_correctness: 0.5 }),
      baseline,
    )
    expect(result.improvements).toEqual([
      { metric: 'faithfulness', current: 0.95, baseline: 0.8, delta: 0.15 },
    ])
  })

  it('reports metrics missing on either side', () => {
    const result = new BaselineComparator().compare(
      report({ faithfulness: 0.8, relevance: 0.7, answer_correctness: 0.5, context_recall: 0.9 }),
      { ...baseline, aggregate: { faithfulness: 0.8 } },
    )
    expect(result.missingMetrics.sort()).toEqual(['answer_correctness', 'context_recall', 'relevance'])
  })

  it('respects a custom threshold', () => {
    const strict = new BaselineComparator(0.05)
    const result = strict.compare(
      report({ faithfulness: 0.73, relevance: 0.7, answer_correctness: 0.5 }),
      baseline,
    )
    expect(result.overall).toBe('flag')
  })

  it('saves a baseline file that can be loaded back', () => {
    const dir = mkdtempSync(join(tmpdir(), 'agenthood-baseline-'))
    const path = join(dir, 'baselines', 'the-reviewer.json')
    try {
      const comparator = new BaselineComparator()
      const saved = comparator.saveBaseline(report({ faithfulness: 0.8 }), path)
      expect(saved.member).toBe('the-reviewer')
      expect(saved.suiteName).toBe('demo-suite')
      expect(saved.taskCount).toBe(0)
      expect(comparator.loadBaseline(path)).toEqual(saved)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('returns null when the baseline file is missing', () => {
    expect(new BaselineComparator().loadBaseline(join(tmpdir(), 'agenthood-missing-baseline.json'))).toBeNull()
  })

  it('returns null when the baseline file is invalid', () => {
    const dir = mkdtempSync(join(tmpdir(), 'agenthood-baseline-'))
    const path = join(dir, 'bad.json')
    try {
      writeFileSync(path, '{ not json', 'utf8')
      expect(new BaselineComparator().loadBaseline(path)).toBeNull()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
