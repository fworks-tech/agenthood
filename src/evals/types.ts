export type TaskDifficulty = 'easy' | 'medium' | 'hard'

export type AssertionType = 'exact' | 'contains' | 'regex' | 'semantic'

export interface Assertion {
  type: AssertionType
  target: string
  /** Relative weight in the partial-credit mean; defaults to 1. */
  weight?: number
  /** Regex flags (e.g. 'i') for `regex` assertions. */
  flags?: string
  /** Minimum similarity to pass; only used by `semantic`. Defaults to 0.8. */
  threshold?: number
}

export interface EvalTask {
  input: string
  expectedOutput: string
  tags?: string[]
  difficulty?: TaskDifficulty
  assertions?: Assertion[]
}

export interface EvalSuite {
  name: string
  description?: string
  tasks: EvalTask[]
  metrics?: string[]
  baseline?: string
}

export interface EvalRunRecord {
  version: string
  timestamp: string
  member: string
  suiteName: string
  passRate: number
  aggregate: Record<string, number>
  taskCount: number
  durationMs: number
}

export interface ConvergenceConfig {
  windowSize: number
  threshold: number
  minRuns: number
}

export interface ConvergenceResult {
  converged: boolean
  runsObserved: number
  variance: number
  meanPassRate: number
  config: ConvergenceConfig
}

export interface RegressionResult {
  isRegression: boolean
  currentPassRate: number
  bestPassRate: number
  delta: number
  threshold: number
}

export interface ABTaskScore {
  input: string
  expectedOutput: string
  outputA: string
  outputB: string
  scoresA: Record<string, number>
  scoresB: Record<string, number>
  deltas: Record<string, number>
}

export interface SignificanceResult {
  tStatistic: number
  pValue: number
  df: number
  significant: boolean
  effectSize: number
  effectLabel: 'negligible' | 'small' | 'medium' | 'large'
}

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
