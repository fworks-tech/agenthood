import { readFileSync } from "node:fs"
import { readdirSync, statSync } from "node:fs"
import { extname, join, relative } from "node:path"
import type { ILLMProvider } from "../llm/ILLMProvider.ts"
import type { IVectorStore, VectorRecord } from "../memory/VectorStore.ts"
import type { ChunkStrategy } from "./ChunkStrategy.ts"
import { FixedSizeChunkStrategy } from "./ChunkStrategy.ts"

export interface IndexOptions {
  chunkStrategy?: ChunkStrategy
  embedder: ILLMProvider
  vectorStore: IVectorStore
  chunkSize?: number
  chunkOverlap?: number
}

export interface IndexStats {
  totalDocuments: number
  totalChunks: number
  indexedExtensions: string[]
}

export class Indexer {
  private chunkStrategy: ChunkStrategy
  private embedder: ILLMProvider
  private vectorStore: IVectorStore
  private totalDocuments = 0
  private totalChunks = 0
  private indexedExtensions = new Set<string>()

  constructor(options: IndexOptions) {
    this.chunkStrategy = options.chunkStrategy ?? new FixedSizeChunkStrategy()
    this.embedder = options.embedder
    this.vectorStore = options.vectorStore
  }

  async indexDocument(filePath: string, content: string): Promise<void> {
    const ext = extname(filePath).toLowerCase()
    this.indexedExtensions.add(ext)

    const chunks = this.chunkStrategy.chunk(content, {
      chunkSize: 512,
      overlap: 64,
    })

    const records: VectorRecord[] = []
    for (const chunk of chunks) {
      const vector = await this.embedder.embed(chunk.content)
      records.push({
        id: `${filePath}::chunk-${chunk.metadata.chunkIndex}`,
        vector,
        metadata: {
          source: filePath,
          chunkIndex: chunk.metadata.chunkIndex,
          startPos: chunk.startPos,
          endPos: chunk.endPos,
          estimatedTokens: chunk.metadata.estimatedTokens,
        },
        content: chunk.content,
        createdAt: new Date(),
      })
    }

    if (records.length > 0) {
      await this.vectorStore.add(records)
    }

    this.totalDocuments++
    this.totalChunks += chunks.length
  }

  async indexDirectory(dirPath: string, filter?: (filePath: string) => boolean): Promise<void> {
    const entries = readdirSync(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name)
      if (entry.isDirectory()) {
        if (entry.name.startsWith(".") || entry.name === "node_modules") continue
        await this.indexDirectory(fullPath, filter)
      } else if (entry.isFile()) {
        if (filter && !filter(fullPath)) continue
        try {
          const content = readFileSync(fullPath, "utf8")
          await this.indexDocument(fullPath, content)
        } catch {
          // skip unreadable files
        }
      }
    }
  }

  stats(): IndexStats {
    return {
      totalDocuments: this.totalDocuments,
      totalChunks: this.totalChunks,
      indexedExtensions: Array.from(this.indexedExtensions).sort(),
    }
  }
}
