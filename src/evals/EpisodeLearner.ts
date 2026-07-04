import type { EvalResult, LongTermMemory } from "../core/types.ts"
import type { ExecutionContext } from "../core/ExecutionContext.ts"
import type { ResidualMemory } from "../memory/ResidualMemory.ts"
import type { SemanticPatternMatcher } from "./SemanticPatternMatcher.ts"

export interface LearningOutcome {
  pattern: string
  score: number
  member: string
  skill: string
}

export function hashPattern(pattern: string): string {
  let hash = 0
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}

const HIGH_SCORE_THRESHOLD = 0.8
const LOW_SCORE_THRESHOLD = 0.4

export class EpisodeLearner {
  private residualMemory?: ResidualMemory
  private matcher?: SemanticPatternMatcher

  constructor(residualMemory?: ResidualMemory, matcher?: SemanticPatternMatcher) {
    this.residualMemory = residualMemory
    this.matcher = matcher
  }

  async learn(
    evalResult: EvalResult,
    context: ExecutionContext,
  ): Promise<void> {
    if (!evalResult.scores || Object.keys(evalResult.scores).length === 0) {
      return
    }

    const episode = await context.memory.episodic.getEpisode(evalResult.episodeId)
    if (!episode) return

    const member = evalResult.metadata?.member ?? "unknown"
    const skill = evalResult.metadata?.skill ?? "unknown"
    const avgScore = this.averageScore(evalResult.scores)

    if (avgScore >= HIGH_SCORE_THRESHOLD) {
      await this.handleHighScore(episode, avgScore, member, skill, context.memory.longTerm, context)
    } else if (avgScore < LOW_SCORE_THRESHOLD) {
      await this.handleLowScore(episode, avgScore, member, skill, context.memory.longTerm, context)
    } else {
      context.tracer.endSpan("episode-learner", {
        action: "skip",
        episodeId: evalResult.episodeId,
        avgScore,
      })
    }
  }

  private averageScore(scores: Record<string, number>): number {
    const values = Object.values(scores)
    if (values.length === 0) return 0
    return values.reduce((a, b) => a + b, 0) / values.length
  }

  private async handleHighScore(
    episode: { episode: string; outcome: string; timestamp: string },
    score: number,
    member: string,
    skill: string,
    longTerm: LongTermMemory,
    context?: ExecutionContext,
  ): Promise<void> {
    const pattern = `learned:${member}:${skill}:${episode.episode}`
    const outcome: LearningOutcome = { pattern, score, member, skill }

    if (this.matcher && context?.llm) {
      const matched = await this.matcher.match(episode.episode, context.llm)
      if (matched) {
        const key = `learnings/${hashPattern(matched.outcome.pattern)}`
        await longTerm.store(key, outcome)
        this.residualMemory?.record(matched.outcome.pattern, score)
        return
      }
      await this.matcher.addPattern(outcome, context.llm)
    }

    const key = `learnings/${hashPattern(pattern)}`
    await longTerm.store(key, outcome)

    this.residualMemory?.record(pattern, score)
  }

  private async handleLowScore(
    episode: { episode: string; outcome: string; timestamp: string },
    score: number,
    member: string,
    skill: string,
    longTerm: LongTermMemory,
    context?: ExecutionContext,
  ): Promise<void> {
    const pattern = `antipattern:${member}:${skill}:${episode.episode}`
    const outcome: LearningOutcome = { pattern, score: 1 - score, member, skill }

    if (this.matcher && context?.llm) {
      const matched = await this.matcher.match(episode.episode, context.llm)
      if (matched) {
        const key = `antipatterns/${hashPattern(matched.outcome.pattern)}`
        await longTerm.store(key, outcome)
        this.residualMemory?.record(matched.outcome.pattern, -score)
        return
      }
      await this.matcher.addPattern(outcome, context.llm)
    }

    const key = `antipatterns/${hashPattern(pattern)}`
    await longTerm.store(key, outcome)

    this.residualMemory?.record(pattern, -score)
  }
}
