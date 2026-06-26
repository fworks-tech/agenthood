import type { IVectorStore, VectorRecord } from "./VectorStore.ts"

export class LongTermMemoryImpl {
  private vectorStore: IVectorStore

  constructor(vectorStore: IVectorStore) {
    this.vectorStore = vectorStore
  }

  async store(key: string, value: unknown): Promise<void> {
    const serialized = JSON.stringify(value)
    const vector = new Array(1536).fill(0)
    await this.vectorStore.add([{
      id: `ltm:${key}`,
      vector,
      metadata: { type: "long_term", key, storedAt: new Date().toISOString() },
      content: serialized,
      createdAt: new Date(),
    }])
  }

  async retrieve(key: string): Promise<unknown> {
    try {
      const results = await this.vectorStore.search(new Array(1536).fill(0), 1, { key })
      if (results.length === 0) return null
      return JSON.parse(results[0].record.content)
    } catch {
      return null
    }
  }

  async delete(key: string): Promise<number> {
    return this.vectorStore.delete({ key })
  }
}
