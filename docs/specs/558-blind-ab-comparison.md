# Spec: Blind A/B Comparison for Skill Version Testing

**Issue:** #558
**Depends on:** #562 (skill regression testing — merged via #775)
**Pattern reference:** docs/specs/562-skill-regression-testing.md

## Problem

Comparing two versions of a skill requires controlled, unbiased evaluation. Without a blind comparison mechanism, skill authors rely on gut feel or sequential evaluation (which introduces order bias). There is no way to determine whether version B is genuinely better than version A, or whether observed differences are within noise.

## Proposed Solution

Add a blind A/B comparison mode to the eval command. Two members run against the same suite; each task's outputs are scored independently by an LLM judge that does not know which member produced which output. Scores are aggregated across tasks and a paired t-test determines whether the observed difference is statistically significant.

## Data Model

```typescript
// Per-task blind scores for both members.
export interface ABTaskScore {
  input: string
  expectedOutput: string
  outputA: string
  outputB: string
  scoresA: Record<string, number>
  scoresB: Record<string, number>
  /** Per-metric delta (B - A) for this task. */
  deltas: Record<string, number>
}

// Result of a full A/B comparison.
export interface ABComparisonResult {
  memberA: string
  memberB: string
  suiteName: string
  taskCount: number
  metrics: string[]
  aggregateA: Record<string, number>
  aggregateB: Record<string, number>
  taskScores: ABTaskScore[]
  winner: 'A' | 'B' | 'tie'
  significance: SignificanceResult
}

export interface SignificanceResult {
  /** Paired t-test statistic. */
  tStatistic: number
  /** Two-tailed p-value (approximate). */
  pValue: number
  /** Degrees of freedom (n - 1). */
  df: number
  /** p < 0.05 */
  significant: boolean
  /** Cohen's d for effect size. */
  effectSize: number
  /** 'small' | 'medium' | 'large' per Cohen's conventions. */
  effectLabel: 'negligible' | 'small' | 'medium' | 'large'
}
```

## Metrics

Three new judge metrics for A/B comparison:

| Metric | Rubric |
|--------|--------|
| clarity | How clear, well-structured, and easy to understand the response is. |
| completeness | How thoroughly the response addresses all aspects of the task. |
| accuracy | How factually correct and precise the response is. |

These complement the existing metrics (faithfulness, relevance, context_recall, answer_correctness) and are optimized for direct output-to-output comparison.

## Pure Functions (`src/evals/abComparison.ts`)

```typescript
/** Mean of a number series; 0 for empty. */
export function mean(values: number[]): number

/** Sample standard deviation; 0 for fewer than 2 values. */
export function sampleStdDev(values: number[]): number

/** Paired t-test on per-task score differences (B - A). */
export function pairedTTest(differences: number[]): { tStatistic: number; pValue: number; df: number }

/** Cohen's d for paired samples. */
export function cohensD(differences: number[]): number

/** Classify effect size per Cohen's conventions. */
export function effectLabel(d: number): 'negligible' | 'small' | 'medium' | 'large'

/** Aggregate per-task scores into per-metric means for each member. */
export function aggregateABScores(taskScores: ABTaskScore[], metrics: string[]): {
  aggregateA: Record<string, number>
  aggregateB: Record<string, number>
}

/** Determine winner by majority of metrics where one member leads. */
export function determineWinner(aggregateA: Record<string, number>, aggregateB: Record<string, number>, metrics: string[]): 'A' | 'B' | 'tie'
```

- `pairedTTest`: computes mean difference, sample standard error, t = mean / SE. Uses normal approximation with small-sample correction for the two-tailed p-value.
- `cohensD`: mean difference / standard deviation of differences.
- `effectLabel`: |d| < 0.2 negligible, < 0.5 small, < 0.8 medium, else large.

## Blind Judge (`src/evals/BlindJudge.ts`)

```typescript
export class BlindJudge {
  constructor(private readonly judge: EvalJudge) {}

  async compareTask(
    input: string,
    expectedOutput: string,
    outputA: string,
    outputB: string,
    metrics: string[],
  ): Promise<ABTaskScore>
}
```

- For each metric, scores outputA and outputB independently via two separate `judge.score()` calls.
- No randomization needed since each output is scored in isolation (no order bias).
- Computes deltas (B - A) per metric.

## CLI Integration (`src/commands/eval.ts`)

New flag: `--ab <memberB>`

```
agenthood eval <memberA> --ab <memberB> --suite <path>
```

When `--ab` is set:
1. Run memberA against the suite → reportA
2. Run memberB against the suite → reportB
3. For each task, call `BlindJudge.compareTask()` with both outputs
4. Aggregate scores and run significance tests
5. Print comparison table and result

Exit codes: 0 = A wins or tie, 1 = B wins (useful for CI gating on regression).

### Output Format

```
  A/B Comparison — the-scribe (A) vs the-scribe-v2 (B)
  Suite: the-scribe.json | Tasks: 5 | Metrics: clarity, completeness, accuracy

  Per-task:
  Task 1: "Write a commit message..."
    A: cl 0.85, co 0.90, ac 0.88 | avg 0.877
    B: cl 0.92, co 0.87, ac 0.91 | avg 0.900
    Δ: +0.023 → B

  ...

  Aggregate:
             A      B      Δ
    clarity: 0.83   0.89   +0.06
    comp.:   0.88   0.85   -0.03
    acc.:    0.86   0.90   +0.04

  Winner: B (2/3 metrics, significant, p=0.032)
  Effect: medium (Cohen's d = 0.45)
```

## Out of Scope (YAGNI)

- Multiple judges (one LLM judge is sufficient for now)
- Visualization / dashboards
- Automatic CI gating on A/B results (exit code is enough)
- Cross-suite A/B comparison
- History tracking for A/B results
- Per-metric significance testing (only overall)

## Testing Strategy

1. **Unit** (`tests/unit/evals/abComparison.test.ts`): Pure functions with synthetic data. t-test against known values, Cohen's effect size, winner determination, edge cases (empty, single task, all ties).
2. **Unit** (`tests/unit/evals/BlindJudge.test.ts`): Mock judge returns fixed scores. Verify correct mapping of scores to A/B, delta computation, metric coverage.
