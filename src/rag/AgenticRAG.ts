import type { RetrievalResult } from "./Retriever.ts"
import { Retriever } from "./Retriever.ts"
import type { RetrievalOptions } from "./Retriever.ts"
import type { IGraphStore } from "./KnowledgeGraphStore.ts"
import type { ILLMProvider } from "../llm/ILLMProvider.ts"
import type { IVectorStore } from "../memory/VectorStore.ts"
import type { ExecutionContext } from "../core/ExecutionContext.js"
import { RetrievalClassifier } from "../skills/rag/RetrievalClassifier.js"
import type { RetrievalStrategy } from "../skills/rag/RetrievalClassifier.js"

export interface AgenticRetrievalResult extends RetrievalResult {
  strategy: RetrievalStrategy
  vectorMatches: number
  graphHops: number
  sourcePaths: string[]
}

export interface AgenticRAGOptions {
  embedder: ILLMProvider
  vectorStore: IVectorStore
  knowledgeGraphStore?: IGraphStore
  parentStorePath?: string
  decisionSkill?: RetrievalClassifier
}

export class AgenticRAG {
  private retriever: Retriever
  private knowledgeGraphStore?: IGraphStore
  private decisionSkill: RetrievalClassifier
  private embedder: ILLMProvider

  constructor(options: AgenticRAGOptions) {
    this.retriever = new Retriever(
      options.embedder,
      options.vectorStore,
      options.knowledgeGraphStore,
      options.parentStorePath,
    )
    this.knowledgeGraphStore = options.knowledgeGraphStore
    this.decisionSkill = options.decisionSkill ?? new RetrievalClassifier()
    this.embedder = options.embedder
  }

  async retrieve(
    query: string,
    context: ExecutionContext,
    retrievalOptions?: RetrievalOptions,
  ): Promise<AgenticRetrievalResult[]> {
    const strategy = await this.decideStrategy(query, context)
    const results: AgenticRetrievalResult[] = []

    if (strategy === 'skip') {
      return [{
        content: '',
        score: 0,
        source: 'short-term-memory',
        chunkIndex: 0,
        strategy: 'skip',
        vectorMatches: 0,
        graphHops: 0,
        sourcePaths: [],
      }]
    }

    if (strategy === 'graph') {
      if (this.knowledgeGraphStore) {
        const graphResults = await this.executeGraphStrategy(query)
        results.push(...graphResults)
      } else {
        const vectorFallback = await this.retriever.retrieve(query, {
          ...retrievalOptions,
          resolveParents: true,
        })
        for (const r of vectorFallback) {
          results.push({
            ...r,
            strategy: 'graph' as RetrievalStrategy,
            vectorMatches: vectorFallback.length,
            graphHops: 0,
            sourcePaths: [r.source],
          })
        }
      }
      return results
    }

    if (strategy === 'vector' || strategy === 'both') {
      const vectorResults = await this.retriever.retrieve(query, {
        ...retrievalOptions,
        resolveParents: true,
      })
      for (const r of vectorResults) {
        results.push({
          ...r,
          strategy,
          vectorMatches: vectorResults.length,
          graphHops: 0,
          sourcePaths: [r.source],
        })
      }
    }

    if (strategy === 'both' && this.knowledgeGraphStore) {
      const graphResults = await this.executeGraphStrategy(query)
      if (results.length > 0) {
        const existing = results[0]
        existing.graphHops = graphResults.length > 0 ? graphResults[0].graphHops : 0
        existing.sourcePaths = [...existing.sourcePaths, ...graphResults.flatMap((g) => g.sourcePaths)]
        if (graphResults.length > 0) {
          existing.content = [existing.content, ...graphResults.map((g) => `Graph neighbors: ${g.sourcePaths.join('; ')}`)].filter(Boolean).join(' | ')
        }
      } else {
        results.push(...graphResults)
      }
    }

    return results
  }

  private async executeGraphStrategy(query: string): Promise<AgenticRetrievalResult[]> {
    if (!this.knowledgeGraphStore) return []

    const graphHops = 2
    const graphNodeIds = await this.resolveGraphNodes(query)
    const sourcePaths: string[] = []

    for (const nodeId of graphNodeIds) {
      try {
        const neighbors = this.knowledgeGraphStore.neighbors(nodeId)
        for (const neighbor of neighbors) {
          sourcePaths.push(`${nodeId} -> ${neighbor.node.id}`)
        }
      } catch {
        // node not found — skip
      }
    }

    if (sourcePaths.length === 0) return []

    return [{
      content: `Graph traversal from: ${graphNodeIds.join(', ')}. Neighbors: ${sourcePaths.join('; ')}`,
      score: 0.5,
      source: 'knowledge-graph',
      chunkIndex: 0,
      strategy: 'graph',
      vectorMatches: 0,
      graphHops,
      sourcePaths,
    }]
  }

  private async decideStrategy(query: string, context: ExecutionContext): Promise<RetrievalStrategy> {
    const result = await this.decisionSkill.execute({ query }, context)
    if (!result.success) return 'vector'
    return result.output as RetrievalStrategy
  }

  private async resolveGraphNodes(query: string): Promise<string[]> {
    if (!this.knowledgeGraphStore) return []

    const searchResults = this.knowledgeGraphStore.search(query)
    return searchResults.slice(0, 3).map((r) => r.id)
  }
}
