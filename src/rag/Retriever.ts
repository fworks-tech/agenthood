import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import type { ILLMProvider } from "../llm/ILLMProvider.ts"
import type { IVectorStore } from "../memory/VectorStore.ts"
import type { IGraphStore } from "./KnowledgeGraphStore.ts"
import type { ParentChunk } from "./ChunkStrategy.ts"

export interface RetrievalOptions {
  topK?: number
  minScore?: number
  metadataFilter?: Record<string, unknown>
  resolveParents?: boolean
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
  private parentStorePath: string | null
  private parentCache: Record<string, ParentChunk> | null = null
  private parentCacheTime = 0
  private readonly parentCacheTTL = 30_000

  constructor(
    embedder: ILLMProvider,
    vectorStore: IVectorStore,
    knowledgeGraphStore?: IGraphStore,
    parentStorePath?: string,
  ) {
    this.embedder = embedder
    this.vectorStore = vectorStore
    this.knowledgeGraphStore = knowledgeGraphStore
    this.parentStorePath = parentStorePath ?? null
  }

  async retrieve(query: string, options?: RetrievalOptions): Promise<RetrievalResult[]> {
    const topK = options?.topK ?? 10
    const minScore = options?.minScore ?? 0.0
    const metadataFilter = options?.metadataFilter
    const resolveParents = options?.resolveParents ?? false

    const queryVector = await this.embedder.embed(query)
    const results = await this.vectorStore.search(queryVector, topK, metadataFilter)

    const parents = resolveParents ? this.loadParents() : null
    const retrievalResults: RetrievalResult[] = []

    for (const result of results) {
      if (result.score < minScore) continue

      const record = result.record
      const meta = record.metadata as Record<string, unknown> | undefined

      if (resolveParents && parents && meta?.isChild && meta?.parentId) {
        const parent = parents[meta.parentId as string]
        if (parent) {
          retrievalResults.push({
            content: parent.content,
            score: result.score,
            source: meta.source as string ?? record.id,
            chunkIndex: 0,
            metadata: { ...meta, resolvedFromChild: record.id, isParent: true, scoreIsFromChild: true },
            graphContext: undefined,
          })
          continue
        }
      }

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
        source: meta?.source as string ?? record.id,
        chunkIndex: meta?.chunkIndex as number ?? 0,
        metadata: record.metadata,
        graphContext,
      })
    }

    return retrievalResults
  }

  private loadParents(): Record<string, ParentChunk> | null {
    if (!this.parentStorePath) return null

    const now = Date.now()
    if (this.parentCache && (now - this.parentCacheTime) < this.parentCacheTTL) {
      return this.parentCache
    }

    const manifestPath = join(this.parentStorePath, 'parents.json')
    if (!existsSync(manifestPath)) return null

    try {
      this.parentCache = JSON.parse(readFileSync(manifestPath, 'utf8'))
      this.parentCacheTime = now
      return this.parentCache
    } catch {
      return null
    }
  }
}
