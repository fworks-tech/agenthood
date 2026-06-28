import type { EvalResult, LongTermMemory } from "../core/types.ts"
import type { ExecutionContext } from "../core/ExecutionContext.ts"
import type { ResidualMemory } from "../memory/ResidualMemory.ts"

export interface LearningOutcome {
  pattern: string
  score: number
  member: string
  skill: string
}

function hashPattern(pattern: string): string {
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

  constructor(residualMemory?: ResidualMemory) {
    this.residualMemory = residualMemory
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
      await this.handleHighScore(episode, avgScore, member, skill, context.memory.longTerm)
    } else if (avgScore < LOW_SCORE_THRESHOLD) {
      await this.handleLowScore(episode, avgScore, member, skill, context.memory.longTerm)
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
  ): Promise<void> {
    const pattern = `learned:${member}:${skill}:${episode.episode}`
    const outcome: LearningOutcome = { pattern, score, member, skill }

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
  ): Promise<void> {
    const pattern = `antipattern:${member}:${skill}:${episode.episode}`
    const outcome: LearningOutcome = { pattern, score: 1 - score, member, skill }

    const key = `antipatterns/${hashPattern(pattern)}`
    await longTerm.store(key, outcome)

    this.residualMemory?.record(pattern, -score)
  }
}
