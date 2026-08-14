import type { EvalResult } from "../core/types.js"
import type { ExecutionContext } from "../core/ExecutionContext.js"
import type { ResidualMemory } from "../memory/ResidualMemory.js"
import type { EmbeddingIndex } from "./EmbeddingIndex.js"
import { hashPattern } from "../utils/hash.js"

export interface LearningOutcome {
  pattern: string
  score: number
  member: string
  skill: string
}

export interface LearnerStatus {
  lastUpdate: string | null
  highScoreCount: number
  midScoreCount: number
  lowScoreCount: number
  totalEpisodes: number
  confidenceTrend: 'rising' | 'falling' | 'stable'
  memberBreakdown: Record<string, { learned: number; antipatterns: number }>
}

const HIGH_SCORE_THRESHOLD = 0.8
const LOW_SCORE_THRESHOLD = 0.4
const TREND_BAND = 0.05
const SCORE_HISTORY_CAP = 50

export class EpisodeLearner {
  private residualMemory?: ResidualMemory
  private index?: EmbeddingIndex
  private highScoreCount = 0
  private midScoreCount = 0
  private lowScoreCount = 0
  private totalEpisodes = 0
  private lastUpdate: string | null = null
  private scoreHistory: number[] = []
  private memberBreakdown: Record<string, { learned: number; antipatterns: number }> = {}

  constructor(residualMemory?: ResidualMemory, index?: EmbeddingIndex) {
    this.residualMemory = residualMemory
    this.index = index
  }

  /** Current learning state: band counts, totals, trend, and per-member breakdown. */
  getStatus(): LearnerStatus {
    return {
      lastUpdate: this.lastUpdate,
      highScoreCount: this.highScoreCount,
      midScoreCount: this.midScoreCount,
      lowScoreCount: this.lowScoreCount,
      totalEpisodes: this.totalEpisodes,
      confidenceTrend: this.confidenceTrend(),
      memberBreakdown: this.memberBreakdown,
    }
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

    this.totalEpisodes++
    this.lastUpdate = new Date().toISOString()
    this.scoreHistory.push(avgScore)
    if (this.scoreHistory.length > SCORE_HISTORY_CAP) this.scoreHistory.shift()

    const data = { episode: episode.episode, score: avgScore, member, skill }
    if (avgScore >= HIGH_SCORE_THRESHOLD) {
      this.highScoreCount++
      this.trackMember(member, 'learned')
      await this.storeOutcome('learned', data, context)
    } else if (avgScore < LOW_SCORE_THRESHOLD) {
      this.lowScoreCount++
      this.trackMember(member, 'antipattern')
      await this.storeOutcome('antipattern', data, context)
    } else {
      this.midScoreCount++
      context.tracer.endSpan("episode-learner", {
        action: "skip",
        episodeId: evalResult.episodeId,
        avgScore,
      })
    }
  }

  private trackMember(member: string, kind: 'learned' | 'antipattern'): void {
    const entry = this.memberBreakdown[member] ?? { learned: 0, antipatterns: 0 }
    if (kind === 'learned') entry.learned++
    else entry.antipatterns++
    this.memberBreakdown[member] = entry
  }

  /** Compares the mean of the newer half of scored episodes against the older half. */
  private confidenceTrend(): 'rising' | 'falling' | 'stable' {
    if (this.scoreHistory.length < 4) return 'stable'
    const half = Math.floor(this.scoreHistory.length / 2)
    const older = this.scoreHistory.slice(0, half)
    const newer = this.scoreHistory.slice(half)
    const olderMean = older.reduce((a, b) => a + b, 0) / older.length
    const newerMean = newer.reduce((a, b) => a + b, 0) / newer.length
    const delta = newerMean - olderMean
    if (delta > TREND_BAND) return 'rising'
    if (delta < -TREND_BAND) return 'falling'
    return 'stable'
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

    let resolvedKey: string
    let residualPattern: string
    if (this.index && context.llm) {
      try {
        const embedding = await context.llm.embed(data.episode)
        const similar = await this.index.findSimilar(embedding)
        if (similar.length > 0) {
          resolvedKey = `${storeKey}/${hashPattern(similar[0].pattern)}`
          residualPattern = similar[0].pattern
        } else {
          await this.index.storePattern(pattern, await context.llm.embed(pattern))
          resolvedKey = `${storeKey}/${hashPattern(pattern)}`
          residualPattern = pattern
        }
      } catch {
        // embedding unavailable (no provider, unsupported embed, store down):
        // degrade to the deterministic hash key instead of failing the run
        resolvedKey = `${storeKey}/${hashPattern(pattern)}`
        residualPattern = pattern
      }
    } else {
      resolvedKey = `${storeKey}/${hashPattern(pattern)}`
      residualPattern = pattern
    }

    await longTerm.store(resolvedKey, outcome)
    this.residualMemory?.record(residualPattern, isLearned ? data.score : -data.score)
  }
}
