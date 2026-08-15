import type { IVectorStore } from '../memory/VectorStore.ts'
import { hashPattern } from '../utils/hash.ts'
import type { LearningOutcome } from './EpisodeLearner.ts'

export interface SimilarPattern {
  pattern: string
  score: number
}

const DEFAULT_THRESHOLD = 0.85
const DEFAULT_LIMIT = 5

/** Marker row id recording the index format version. */
export const INDEX_VERSION_KEY = '__index_version__'
export const INDEX_CURRENT_VERSION = 2

const LEGACY_PATTERN_PREFIXES = ['ltm:learnings', 'ltm:antipatterns']

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

/**
 * Re-embeds legacy LongTermMemory rows (written with zero vectors before the
 * index existed) as queryable `pattern:` rows, then writes the version marker.
 * Idempotent: pattern upserts make re-runs harmless, and the marker is only
 * written after every row was attempted. Throws when embedding fails, so the
 * caller can retry on the next process without a false-complete marker.
 */
export async function reindexLegacyPatterns(
  index: EmbeddingIndex,
  store: IVectorStore,
  embed: (text: string) => Promise<number[]>,
): Promise<number> {
  const marker = await store.getById(INDEX_VERSION_KEY)
  if (marker) {
    try {
      const parsed = JSON.parse(marker.content) as { version?: number }
      if (parsed.version === INDEX_CURRENT_VERSION) return 0
    } catch {
      // corrupt marker: re-run the migration
    }
  }

  let migrated = 0
  for (const prefix of LEGACY_PATTERN_PREFIXES) {
    const rows = await store.getByKeyPrefix(prefix, 10_000)
    for (const row of rows) {
      let outcome: LearningOutcome
      try {
        outcome = JSON.parse(row.content) as LearningOutcome
      } catch {
        continue
      }
      if (!outcome?.pattern) continue
      await index.storePattern(outcome.pattern, await embed(outcome.pattern))
      migrated++
    }
  }

  await store.add([{
    id: INDEX_VERSION_KEY,
    vector: new Array(1536).fill(0),
    metadata: { type: 'index_version' },
    content: JSON.stringify({
      version: INDEX_CURRENT_VERSION,
      migratedAt: new Date().toISOString(),
      migrated,
    }),
    createdAt: new Date(),
  }])
  return migrated
}
