import type { RetrievalResult } from "./Retriever.ts"
import { Retriever } from "./Retriever.ts"
import type { RetrievalOptions } from "./Retriever.ts"
import type { IGraphStore } from "./KnowledgeGraphStore.ts"
import type { ILLMProvider } from "../llm/ILLMProvider.ts"
import type { IVectorStore } from "../memory/VectorStore.ts"
import type { ExecutionContext } from "../core/ExecutionContext.js"
import { RetrievalDecisionSkill } from "../skills/rag/RetrievalDecisionSkill.js"
import type { RetrievalStrategy } from "../skills/rag/RetrievalDecisionSkill.js"

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
  decisionSkill?: RetrievalDecisionSkill
}

export class AgenticRAG {
  private retriever: Retriever
  private knowledgeGraphStore?: IGraphStore
  private decisionSkill: RetrievalDecisionSkill
  private embedder: ILLMProvider

  constructor(options: AgenticRAGOptions) {
    this.retriever = new Retriever(
      options.embedder,
      options.vectorStore,
      options.knowledgeGraphStore,
      options.parentStorePath,
    )
    this.knowledgeGraphStore = options.knowledgeGraphStore
    this.decisionSkill = options.decisionSkill ?? new RetrievalDecisionSkill()
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

    if ((strategy === 'graph' || strategy === 'both') && this.knowledgeGraphStore) {
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

      if (graphNodeIds.length > 0) {
        const existingFirst = results[0]
        if (existingFirst && existingFirst.strategy === 'both') {
          existingFirst.graphHops = graphHops
          existingFirst.sourcePaths = [...existingFirst.sourcePaths, ...sourcePaths]
          existingFirst.content = [existingFirst.content, `Graph neighbors: ${sourcePaths.join('; ')}`]
            .filter(Boolean)
            .join(' | ')
        } else {
          results.push({
            content: `Graph traversal from: ${graphNodeIds.join(', ')}. Neighbors: ${sourcePaths.join('; ')}`,
            score: 0.5,
            source: 'knowledge-graph',
            chunkIndex: 0,
            strategy: 'graph',
            vectorMatches: 0,
            graphHops,
            sourcePaths,
          })
        }
      }
    }

    return results
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
