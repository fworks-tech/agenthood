import type { IVectorStore } from '../memory/VectorStore.ts'
import type { ILLMProvider } from '../llm/ILLMProvider.ts'
import { cosineSimilarity } from '../utils/cosineSimilarity.ts'
import { hashPattern } from '../utils/hash.ts'
import type { LearningOutcome } from './EpisodeLearner.ts'

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

  private async embedWithRetry(text: string, embedder: ILLMProvider, attempts = 2): Promise<number[]> {
    let lastErr: unknown
    for (let i = 1; i <= attempts; i++) {
      try {
        return await embedder.embed(text)
      } catch (err) {
        lastErr = err
        if (i < attempts) await new Promise((r) => setTimeout(r, i * 300))
      }
    }
    throw lastErr
  }

  async initialize(): Promise<void> {
    try {
      const records = await this.vectorStore.getByKeyPrefix('pattern:')
      this.patterns = records.map((r) => ({
        outcome: JSON.parse(r.content) as LearningOutcome,
        embedding: r.vector,
      }))
    } catch (err) {
      console.warn('[SemanticPatternMatcher] failed to load patterns:', err)
      this.patterns = []
    }
  }

  async match(episodeText: string, embedder: ILLMProvider): Promise<MatchResult | null> {
    const embedding = await this.embedWithRetry(episodeText, embedder)
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
    const embedding = await this.embedWithRetry(outcome.pattern, embedder)

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
