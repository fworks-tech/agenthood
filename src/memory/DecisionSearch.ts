import type { IVectorStore } from './VectorStore.js'
import type { DecisionLog, DecisionEntry } from './DecisionLog.js'

export interface Embedder {
  embed(text: string): Promise<number[]>
}

export interface DecisionSearchHit {
  entry: DecisionEntry
  score: number
}

const ID_PREFIX = 'decision:'

export class DecisionSearch {
  constructor(private vectorStore: IVectorStore) {}

  async indexAll(decisions: DecisionLog, embedder: Embedder): Promise<number> {
    const entries = await decisions.all()
    let indexed = 0
    for (const entry of entries) {
      const vectorId = `${ID_PREFIX}${entry.id}`
      const existing = await this.vectorStore.getById(vectorId)
      if (existing) continue
      const vector = await embedder.embed(`${entry.task}\n${entry.decision}`)
      await this.vectorStore.add([
        {
          id: vectorId,
          vector,
          metadata: { member: entry.member, outcome: entry.outcome, decisionId: entry.id },
          content: `${entry.task}\n${entry.decision}`,
          createdAt: new Date(entry.timestamp),
        },
      ])
      indexed++
    }
    return indexed
  }

  async search(decisions: DecisionLog, query: string, embedder: Embedder, topK: number = 5): Promise<DecisionSearchHit[]> {
    const vector = await embedder.embed(query)
    const results = await this.vectorStore.search(vector, topK)
    const hits: DecisionSearchHit[] = []
    for (const { record, score } of results) {
      if (!record.id.startsWith(ID_PREFIX)) continue
      const entry = await decisions.get(record.id.slice(ID_PREFIX.length))
      if (entry) hits.push({ entry, score })
    }
    return hits.sort((a, b) => b.score - a.score)
  }
}
