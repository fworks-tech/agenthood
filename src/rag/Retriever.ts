import type { ILLMProvider } from "../llm/ILLMProvider.ts"
import type { IVectorStore, VectorSearchResult } from "../memory/VectorStore.ts"
import type { IGraphStore } from "./KnowledgeGraphStore.ts"

export interface RetrievalOptions {
  topK?: number
  minScore?: number
  metadataFilter?: Record<string, unknown>
}

export interface RetrievalResult {
  content: string
  score: number
  source: string
  chunkIndex: number
  metadata?: Record<string, unknown>
  graphContext?: string
}

export class Retriever {
  private embedder: ILLMProvider
  private vectorStore: IVectorStore
  private knowledgeGraphStore?: IGraphStore

  constructor(
    embedder: ILLMProvider,
    vectorStore: IVectorStore,
    knowledgeGraphStore?: IGraphStore,
  ) {
    this.embedder = embedder
    this.vectorStore = vectorStore
    this.knowledgeGraphStore = knowledgeGraphStore
  }

  async retrieve(query: string, options?: RetrievalOptions): Promise<RetrievalResult[]> {
    const topK = options?.topK ?? 10
    const minScore = options?.minScore ?? 0.0
    const metadataFilter = options?.metadataFilter

    const queryVector = await this.embedder.embed(query)
    const results = await this.vectorStore.search(queryVector, topK, metadataFilter)

    const retrievalResults: RetrievalResult[] = []

    for (const result of results) {
      if (result.score < minScore) continue

      const record = result.record

      let graphContext: string | undefined
      if (this.knowledgeGraphStore && record.id) {
        try {
          const node = this.knowledgeGraphStore.getNode(record.id)
          const neighbors = this.knowledgeGraphStore.neighbors(record.id)
          if (neighbors.length > 0) {
            const neighborLabels = neighbors.map((n) => n.node.label).join(", ")
            graphContext = `Related to: ${neighborLabels}`
          }
          if (node.metadata) {
            graphContext = [graphContext, `Type: ${node.type}`, `Label: ${node.label}`]
              .filter(Boolean)
              .join(" | ")
          }
        } catch {
          // node not in KGS — no graph context available
        }
      }

      retrievalResults.push({
        content: record.content,
        score: result.score,
        source: (record.metadata as Record<string, unknown> | undefined)?.source as string ?? record.id,
        chunkIndex: (record.metadata as Record<string, unknown> | undefined)?.chunkIndex as number ?? 0,
        metadata: record.metadata,
        graphContext,
      })
    }

    return retrievalResults
  }
}
