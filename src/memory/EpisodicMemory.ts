import type { ILLMProvider } from "../llm/ILLMProvider.ts"
import type { IVectorStore, VectorRecord } from "./VectorStore.ts"

export interface EpisodeEntry {
  episode: string
  outcome: string
  timestamp: Date
}

export class EpisodicMemoryImpl {
  private vectorStore: IVectorStore
  private embedder?: ILLMProvider

  constructor(vectorStore: IVectorStore, embedder?: ILLMProvider) {
    this.vectorStore = vectorStore
    this.embedder = embedder
  }

  async record(episode: string, outcome: string): Promise<void> {
    const content = JSON.stringify({ episode, outcome, timestamp: new Date().toISOString() })

    const vector = this.embedder
      ? await this.embedder.embed(`${episode}\n${outcome}`)
      : new Array(1536).fill(0)

    await this.vectorStore.add([{
      id: `ep:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      vector,
      metadata: {
        type: "episodic",
        recordedAt: new Date().toISOString(),
      },
      content,
      createdAt: new Date(),
    }])
  }

  async getEpisode(id: string): Promise<{ episode: string; outcome: string; timestamp: string } | null> {
    const record = await this.vectorStore.getById(id)
    if (!record) return null
    const parsed = JSON.parse(record.content)
    return {
      episode: parsed.episode,
      outcome: parsed.outcome,
      timestamp: parsed.timestamp,
    }
  }

  async recall(query: string, topK: number = 5): Promise<string[]> {
    const queryVector = this.embedder
      ? await this.embedder.embed(query)
      : new Array(1536).fill(0)

    const results = await this.vectorStore.search(queryVector, topK)
    return results.map((r) => {
      const parsed = JSON.parse(r.record.content)
      return `Episode: ${parsed.episode}\nOutcome: ${parsed.outcome}`
    })
  }
}
