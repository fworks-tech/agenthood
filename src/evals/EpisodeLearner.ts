import type { EvalResult } from "../core/types.ts"
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

    const data = { episode: episode.episode, score: avgScore, member, skill }
    if (avgScore >= HIGH_SCORE_THRESHOLD) {
      await this.storeOutcome('learned', data, context)
    } else if (avgScore < LOW_SCORE_THRESHOLD) {
      await this.storeOutcome('antipattern', data, context)
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

  private async storeOutcome(
    kind: 'learned' | 'antipattern',
    data: { episode: string; score: number; member: string; skill: string },
    context: ExecutionContext,
  ): Promise<void> {
    const isLearned = kind === 'learned'
    const prefix = isLearned ? 'learned' : 'antipattern'
    const storeKey = isLearned ? 'learnings' : 'antipatterns'
    const pattern = `${prefix}:${data.member}:${data.skill}:${data.episode}`
    const outcome: LearningOutcome = {
      pattern,
      score: isLearned ? data.score : 1 - data.score,
      member: data.member,
      skill: data.skill,
    }
    const longTerm = context.memory.longTerm

    if (this.matcher && context.llm) {
      const matched = await this.matcher.match(data.episode, context.llm)
      if (matched) {
        await longTerm.store(`${storeKey}/${hashPattern(matched.outcome.pattern)}`, outcome)
        this.residualMemory?.record(matched.outcome.pattern, isLearned ? data.score : -data.score)
        return
      }
      await this.matcher.addPattern(outcome, context.llm)
    }

    await longTerm.store(`${storeKey}/${hashPattern(pattern)}`, outcome)
    this.residualMemory?.record(pattern, isLearned ? data.score : -data.score)
  }
}
