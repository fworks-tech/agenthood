# Spec: Skill Regression Testing with Iteration Tracking and Convergence Detection

**Issue:** #562
**Depends on:** #519 (eval framework — merged via #656)
**Pattern reference:** docs/specs/594-output-format-validation.md

## Problem

The eval framework is single-snapshot: one baseline per member, overwritten on `--update-baseline`. There is no memory of prior runs, no iteration count, and no signal for when further iteration stops improving quality (convergence). Skill authors cannot detect regression across versions or know when to stop iterating.

## Proposed Solution

Add an append-only run history per member+suite, a pure convergence detector, and regression detection against the best-seen run. Wire both into the existing `eval` CLI so every run is automatically recorded.

## Data Model

```typescript
// One recorded eval run — appended as a JSONL line.
interface EvalRunRecord {
  version: string               // skill version (frontmatter "version" or "0.0.0")
  timestamp: string             // ISO timestamp from EvalReport
  member: string
  suiteName: string
  passRate: number              // 0..1, or -1 if no tasks judgeable
  aggregate: Record<string, number>
  taskCount: number
  durationMs: number            // sum of task durations
}

// Convergence configuration (CLI flags or suite extension).
interface ConvergenceConfig {
  windowSize: number            // runs to look back (default 5)
  threshold: number             // pass rate variance below = converged (default 0.02)
  minRuns: number               // minimum runs before declaring convergence (default 3)
}

// Convergence result.
interface ConvergenceResult {
  converged: boolean
  runsObserved: number
  variance: number
  meanPassRate: number
  config: ConvergenceConfig
}

// Regression result (compared to best-seen run).
interface RegressionResult {
  isRegression: boolean
  currentPassRate: number
  bestPassRate: number
  delta: number
  threshold: number
}
```

## Persistence

- File: `.agenthood/evals/history/<member>.jsonl` (one line per run, append-only)
- Each line is a JSON `EvalRunRecord`
- Directory created lazily on first write
- No overwrite — history grows until explicitly cleared

## Pure Functions (`src/evals/convergence.ts`)

```typescript
export function detectConvergence(history: EvalRunRecord[], config: ConvergenceResult): ConvergenceResult
export function detectRegression(history: EvalRunRecord[], threshold = 0.1): RegressionResult
export function computeVariance(values: number[]): number  // population variance
```

- `detectConvergence`: takes the last `windowSize` runs, computes population variance of pass rates. Converged if variance < `threshold` AND runs observed >= `minRuns`.
- `detectRegression`: compares the latest run's passRate against the max passRate in history. Regression if (best - current) > threshold.
- `computeVariance`: standard population variance (mean of squared deviations).

## Run History (`src/evals/runHistory.ts`)

```typescript
export class RunHistory {
  constructor(private readonly member: string, private readonly rootDir = join(process.cwd(), '.agenthood', 'evals', 'history')) {}
  append(record: EvalRunRecord): void
  load(): EvalRunRecord[]
  loadForSuite(suiteName: string): EvalRunRecord[]
  clear(): void
  static historyPath(member: string, rootDir?: string): string
}
```

- `append`: serializes record to JSON, appends with newline. Creates dir if needed.
- `load`: reads all lines, parses valid JSON lines, skips malformed. Returns oldest-first.
- `loadForSuite`: filters by `suiteName`.
- `clear`: removes the history file.

## CLI Integration (`src/commands/eval.ts`)

Every eval run auto-records to history (no flag needed). New flags:

| Flag | Purpose |
|------|---------|
| `--convergence` | After eval, check convergence and print status |
| `--history` | Print run history table for this member |

Exit codes unchanged (0 = pass, 1 = regression, 2 = schema error). Convergence is informational — does not affect exit code.

When `--convergence` is set:
- Load history for this member+suite
- Run `detectConvergence`
- Print `Converged: yes/no | runs: N | variance: X.XX | mean pass rate: XX.X%`

## Out of Scope (YAGNI)

- Visualization / dashboards
- Automatic iteration stopping (just report convergence; caller decides)
- Cross-suite convergence (only per-member+suite)
- History pruning / TTL
- Embedding-based comparison (separate issue)

## Testing Strategy

1. **Unit** (`tests/unit/evals/convergence.test.ts`): Pure functions with synthetic histories. Converged/not-converged, regression/not, edge cases (empty history, single run).
2. **Unit** (`tests/unit/evals/runHistory.test.ts`): Append/load/clear/loadForSuite with temp dirs. Malformed line handling.
