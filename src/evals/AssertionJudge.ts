import { cosineSimilarity } from '../utils/cosineSimilarity.ts'
import type { Assertion } from './types.ts'
import type { EmbedFn } from './ReplayEvaluator.ts'

/** Minimum cosine similarity for a `semantic` assertion to pass. */
export const DEFAULT_ASSERTION_THRESHOLD = 0.8

export interface AssertionResult {
  type: Assertion['type']
  target: string
  passed: boolean
  /** 1/0 for deterministic types; raw cosine in [0,1] for `semantic`. */
  score: number
  weight: number
}

export interface AssertionGrade {
  /** Weighted partial-credit mean of the per-assertion scores, rounded to 4dp. */
  score: number
  passed: number
  total: number
  results: AssertionResult[]
}

/**
 * Grades a single assertion against an output. Deterministic types yield 1 or 0;
 * `semantic` yields cosine similarity and passes at/above its threshold. Without
 * an embedder a `semantic` assertion cannot be graded and fails safely.
 */
export async function gradeAssertion(
  assertion: Assertion,
  output: string,
  embed?: EmbedFn,
): Promise<{ passed: boolean; score: number }> {
  const threshold = assertion.threshold ?? DEFAULT_ASSERTION_THRESHOLD
  switch (assertion.type) {
    case 'exact': {
      const score = output.trim() === assertion.target.trim() ? 1 : 0
      return { passed: score >= threshold, score }
    }
    case 'contains': {
      const score = output.includes(assertion.target) ? 1 : 0
      return { passed: score >= threshold, score }
    }
    case 'regex': {
      try {
        const score = new RegExp(assertion.target, assertion.flags).test(output) ? 1 : 0
        return { passed: score >= threshold, score }
      } catch {
        return { passed: false, score: 0 }
      }
    }
    case 'semantic': {
      if (!embed) return { passed: false, score: 0 }
      try {
        const [a, b] = await Promise.all([embed(output), embed(assertion.target)])
        const score = cosineSimilarity(a, b)
        return { passed: score >= threshold, score }
      } catch {
        return { passed: false, score: 0 }
      }
    }
  }
}

/** Grades every assertion and folds them into a weighted partial-credit score. */
export async function gradeAssertions(
  assertions: Assertion[],
  output: string,
  embed?: EmbedFn,
): Promise<AssertionGrade> {
  const results: AssertionResult[] = []
  for (const assertion of assertions) {
    const { passed, score } = await gradeAssertion(assertion, output, embed)
    results.push({
      type: assertion.type,
      target: assertion.target,
      passed,
      score,
      weight: assertion.weight ?? 1,
    })
  }
  const totalWeight = results.reduce((sum, r) => sum + r.weight, 0)
  const weighted = results.reduce((sum, r) => sum + r.weight * r.score, 0)
  const score = totalWeight === 0 ? 0 : Math.round((weighted / totalWeight) * 10000) / 10000
  return {
    score,
    passed: results.filter((r) => r.passed).length,
    total: results.length,
    results,
  }
}
