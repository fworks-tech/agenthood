export { EpisodeLearner } from "./EpisodeLearner.ts"
export type { LearningOutcome } from "./EpisodeLearner.ts"
export { EmbeddingIndex } from "./EmbeddingIndex.ts"
export type { SimilarPattern } from "./EmbeddingIndex.ts"
export { reindexLegacyPatterns, INDEX_CURRENT_VERSION, INDEX_VERSION_KEY } from "./EmbeddingIndex.ts"
export { SemanticPatternMatcher } from "./SemanticPatternMatcher.ts"
export type { StoredPattern, MatchResult } from "./SemanticPatternMatcher.ts"
export { hashPattern } from "../utils/hash.ts"
export type { EvalSuite, EvalTask, TaskDifficulty } from "./types.ts"
export { EVAL_SUITE_SCHEMA, validateEvalSuite, loadEvalSuite } from "./evalSuiteSchema.ts"
export type { EvalJudge, JudgeContext } from "./EvalJudge.ts"
export { LLMJudge, parseJudgeScore, JUDGE_SYSTEM_PROMPT } from "./EvalJudge.ts"
export {
  EvalRunner,
  DEFAULT_METRICS,
  buildEvalResults,
} from "./EvalRunner.ts"
export type {
  MemberRunResult,
  RunMemberFn,
  TaskStatus,
  TaskScore,
  EvalReport,
} from "./EvalRunner.ts"
export { BaselineComparator, DEFAULT_THRESHOLD } from "./BaselineComparator.ts"
export type { MetricDelta, RegressionReport, BaselineRecord } from "./BaselineComparator.ts"
export { ReplayEvaluator } from "./ReplayEvaluator.ts"
export type { ReplayTaskScore, ReplayReport, EmbedFn } from "./ReplayEvaluator.ts"