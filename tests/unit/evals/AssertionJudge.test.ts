import { describe, it, expect, vi } from 'vitest'
import {
  gradeAssertion,
  gradeAssertions,
  DEFAULT_ASSERTION_THRESHOLD,
} from '../../../src/evals/AssertionJudge.ts'
import type { Assertion } from '../../../src/evals/types.ts'
import type { EmbedFn } from '../../../src/evals/ReplayEvaluator.ts'

// Text-keyed embedder so output and target can map to different vectors.
// cos([0,1,0],[1,0,0]) = 0; cos([1,1,0],[1,0,0]) = 1/sqrt(2) ~ 0.707.
const VECTORS: Record<string, number[]> = {
  'out-same': [1, 0, 0], 'exp-same': [1, 0, 0],
  'out-orth': [0, 1, 0], 'exp-orth': [1, 0, 0],
  'out-diag': [1, 1, 0], 'exp-diag': [1, 0, 0],
}
const keyed: EmbedFn = async (text) => VECTORS[text] ?? [1, 0, 0]

describe('AssertionJudge — deterministic types', () => {
  it('exact: passes only on trimmed string equality', async () => {
    const a: Assertion = { type: 'exact', target: 'hello' }
    expect((await gradeAssertion(a, 'hello')).passed).toBe(true)
    expect((await gradeAssertion(a, '  hello  ')).passed).toBe(true)
    expect((await gradeAssertion(a, 'hello world')).passed).toBe(false)
  })

  it('contains: substring match, case-sensitive', async () => {
    const a: Assertion = { type: 'contains', target: 'world' }
    expect((await gradeAssertion(a, 'hello world')).passed).toBe(true)
    expect((await gradeAssertion(a, 'hello World')).passed).toBe(false)
    expect((await gradeAssertion(a, 'nope')).passed).toBe(false)
  })

  it('regex: matches with optional flags', async () => {
    const a: Assertion = { type: 'regex', target: '^\\d+ items$' }
    expect((await gradeAssertion(a, '42 items')).passed).toBe(true)
    expect((await gradeAssertion(a, 'items 42')).passed).toBe(false)
    expect((await gradeAssertion({ ...a, target: 'WORLD', flags: 'i' }, 'hello world')).passed).toBe(true)
  })

  it('regex: invalid pattern fails safely instead of throwing', async () => {
    const a: Assertion = { type: 'regex', target: '([unclosed' }
    const g = await gradeAssertion(a, 'anything')
    expect(g.passed).toBe(false)
    expect(g.score).toBe(0)
  })

  it('exact/contains/regex score are 1 (pass) or 0 (fail)', async () => {
    expect((await gradeAssertion({ type: 'contains', target: 'alpha' }, 'alpha')).score).toBe(1)
    expect((await gradeAssertion({ type: 'contains', target: 'alpha' }, 'beta')).score).toBe(0)
  })
})

describe('AssertionJudge — semantic type', () => {
  it('scores by cosine similarity and passes at/above threshold', async () => {
    const g = await gradeAssertion({ type: 'semantic', target: 'exp-same' }, 'out-same', keyed)
    expect(g.score).toBeCloseTo(1, 5)
    expect(g.passed).toBe(true)
  })

  it('fails when similarity is below threshold', async () => {
    const g = await gradeAssertion({ type: 'semantic', target: 'exp-orth' }, 'out-orth', keyed)
    expect(g.score).toBeCloseTo(0, 5)
    expect(g.passed).toBe(false)
  })

  it('honours a custom threshold', async () => {
    const g = await gradeAssertion(
      { type: 'semantic', target: 'exp-diag', threshold: 0.6 },
      'out-diag',
      keyed,
    )
    expect(g.score).toBeCloseTo(0.707, 2)
    expect(g.passed).toBe(true)
  })

  it('without an embedder a semantic assertion cannot pass', async () => {
    const g = await gradeAssertion({ type: 'semantic', target: 'alpha' }, 'alpha')
    expect(g.passed).toBe(false)
    expect(g.score).toBe(0)
  })
})

describe('AssertionJudge — aggregation with partial credit', () => {
  it('weighted mean of per-assertion scores', async () => {
    const assertions: Assertion[] = [
      { type: 'contains', target: 'alpha' },
      { type: 'contains', target: 'bravo' },
    ]
    const g = await gradeAssertions(assertions, 'has alpha only')
    expect(g.total).toBe(2)
    expect(g.passed).toBe(1)
    expect(g.score).toBeCloseTo(0.5, 5)
  })

  it('respects weights', async () => {
    const assertions: Assertion[] = [
      { type: 'contains', target: 'alpha', weight: 1 },
      { type: 'contains', target: 'bravo', weight: 3 },
    ]
    const g = await gradeAssertions(assertions, 'only bravo here')
    // alpha=0*w1, bravo=1*w3 -> 3/4
    expect(g.score).toBeCloseTo(0.75, 5)
  })

  it('defaults threshold and weight, rounds score to 4dp', async () => {
    expect(DEFAULT_ASSERTION_THRESHOLD).toBe(0.8)
    const assertions: Assertion[] = [
      { type: 'contains', target: 'foo' },
      { type: 'contains', target: 'bar' },
      { type: 'contains', target: 'baz' },
    ]
    const g = await gradeAssertions(assertions, 'foo and bar only')
    expect(g.score).toBeCloseTo(0.6667, 4)
    expect(g.results).toHaveLength(3)
  })

  it('empty assertion list scores a neutral zero with total 0', async () => {
    const g = await gradeAssertions([], 'anything')
    expect(g.total).toBe(0)
    expect(g.score).toBe(0)
  })

  it('calls the embedder only for semantic assertions (once per vector)', async () => {
    const spy = vi.fn(keyed)
    await gradeAssertions([{ type: 'contains', target: 'alpha' }], 'alpha', spy)
    expect(spy).not.toHaveBeenCalled()
    await gradeAssertions([{ type: 'semantic', target: 'exp-same' }], 'out-same', spy)
    // output + target each embedded
    expect(spy).toHaveBeenCalledTimes(2)
  })
})
