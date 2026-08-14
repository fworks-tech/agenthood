import type { IVectorStore } from '../memory/VectorStore.js'
import { hashPattern } from '../utils/hash.js'

export interface SimilarPattern {
  pattern: string
  score: number
}

const DEFAULT_THRESHOLD = 0.85
const DEFAULT_LIMIT = 5

/**
 * Persistent nearest-neighbor index over learned patterns. Rows live in the
 * LanceDB vectors table under `pattern:` keys derived from the pattern text,
 * so a repeated pattern upserts instead of accumulating duplicates.
 */
export class EmbeddingIndex {
  constructor(
    private readonly vectorStore: IVectorStore,
    private readonly threshold = DEFAULT_THRESHOLD,
  ) {}

  private patternKey(pattern: string): string {
    return `pattern:${hashPattern(pattern)}`
  }

  /**
   * Upserts a pattern embedding by its derived key and returns the stored key.
   */
  async storePattern(pattern: string, embedding: number[]): Promise<string> {
    const key = this.patternKey(pattern)
    const existing = await this.vectorStore.getById(key)
    if (existing) await this.vectorStore.delete(key)
    await this.vectorStore.add([{
      id: key,
      vector: embedding,
      metadata: { type: 'learned_pattern' },
      content: pattern,
      createdAt: new Date(),
    }])
    return key
  }

  /**
   * Nearest neighbors above the similarity threshold, highest score first.
   * Empty when nothing clears the threshold.
   */
  async findSimilar(embedding: number[], threshold = this.threshold, limit = DEFAULT_LIMIT): Promise<SimilarPattern[]> {
    if (limit <= 0) return []
    const results = await this.vectorStore.search(embedding, limit, { type: 'learned_pattern' })
    const matches: SimilarPattern[] = []
    for (const { record, score } of results) {
      if (score >= threshold) matches.push({ pattern: record.content, score })
    }
    return matches.sort((a, b) => b.score - a.score)
  }
}
