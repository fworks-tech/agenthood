export { EpisodeLearner } from "./EpisodeLearner.js"
export type { LearningOutcome } from "./EpisodeLearner.js"
export { EmbeddingIndex } from "./EmbeddingIndex.js"
export type { SimilarPattern } from "./EmbeddingIndex.js"
export { reindexLegacyPatterns, INDEX_CURRENT_VERSION, INDEX_VERSION_KEY } from "./EmbeddingIndex.js"
export { SemanticPatternMatcher } from "./SemanticPatternMatcher.js"
export type { StoredPattern, MatchResult } from "./SemanticPatternMatcher.js"
export { hashPattern } from "../utils/hash.js"
export type { EvalSuite, EvalTask, TaskDifficulty } from "./types.js"
export { EVAL_SUITE_SCHEMA, validateEvalSuite, loadEvalSuite } from "./evalSuiteSchema.js"
export type { EvalJudge, JudgeContext } from "./EvalJudge.js"
export { LLMJudge, parseJudgeScore, JUDGE_SYSTEM_PROMPT } from "./EvalJudge.js"
export {
  EvalRunner,
  DEFAULT_METRICS,
  buildEvalResults,
} from "./EvalRunner.js"
export type {
  MemberRunResult,
  RunMemberFn,
  TaskStatus,
  TaskScore,
  EvalReport,
} from "./EvalRunner.js"
export { BaselineComparator, DEFAULT_THRESHOLD } from "./BaselineComparator.js"
export type { MetricDelta, RegressionReport, BaselineRecord } from "./BaselineComparator.js"
export { ReplayEvaluator } from "./ReplayEvaluator.js"
export type { ReplayTaskScore, ReplayReport, EmbedFn } from "./ReplayEvaluator.js"