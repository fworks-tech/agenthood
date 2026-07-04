import type { IVectorStore } from '../memory/VectorStore.js'
import type { ILLMProvider } from '../llm/ILLMProvider.js'
import { cosineSimilarity } from '../utils/cosineSimilarity.js'
import type { LearningOutcome } from './EpisodeLearner.js'

function hashPattern(pattern: string): string {
  let hash = 0
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}

export interface StoredPattern {
  outcome: LearningOutcome
  embedding: number[]
}

export interface MatchResult {
  outcome: LearningOutcome
  score: number
}

export class SemanticPatternMatcher {
  private patterns: StoredPattern[] = []
  private threshold: number

  constructor(
    private vectorStore: IVectorStore,
    threshold = 0.85,
  ) {
    this.threshold = threshold
  }

  async initialize(): Promise<void> {
    try {
      const records = await this.vectorStore.getByKeyPrefix('pattern:')
      this.patterns = records.map((r) => ({
        outcome: JSON.parse(r.content) as LearningOutcome,
        embedding: r.vector,
      }))
    } catch {
      this.patterns = []
    }
  }

  async match(episodeText: string, embedder: ILLMProvider): Promise<MatchResult | null> {
    const embedding = await embedder.embed(episodeText)
    let best: MatchResult | null = null

    for (const sp of this.patterns) {
      const score = cosineSimilarity(embedding, sp.embedding)
      if (score >= this.threshold && (!best || score > best.score)) {
        best = { outcome: sp.outcome, score }
      }
    }

    return best
  }

  async addPattern(outcome: LearningOutcome, embedder: ILLMProvider): Promise<void> {
    const patternKey = `pattern:${hashPattern(outcome.pattern)}`
    const embedding = await embedder.embed(outcome.pattern)

    await this.vectorStore.add([{
      id: patternKey,
      vector: embedding,
      metadata: { type: 'learned_pattern' },
      content: JSON.stringify(outcome),
      createdAt: new Date(),
    }])

    this.patterns.push({ outcome, embedding })
  }
}
