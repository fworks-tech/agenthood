import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs"
import { readdirSync, statSync } from "node:fs"
import { extname, join, relative, dirname } from "node:path"
import type { ILLMProvider } from "../llm/ILLMProvider.ts"
import type { IVectorStore, VectorRecord } from "../memory/VectorStore.ts"
import type { ChunkStrategy, HierarchicalChunkStrategy, ParentChunk } from "./ChunkStrategy.ts"
import { FixedSizeChunkStrategy, MarkdownHierarchicalChunkStrategy } from "./ChunkStrategy.ts"
import { TreeSitterParser, languageFromFile } from "./parsers/TreeSitterParser.ts"
import type { CodeEntity } from "./parsers/TreeSitterParser.ts"

export interface IndexOptions {
  chunkStrategy?: ChunkStrategy
  hierarchicalChunkStrategy?: HierarchicalChunkStrategy
  embedder: ILLMProvider
  vectorStore: IVectorStore
  chunkSize?: number
  chunkOverlap?: number
  parentStorePath?: string
}

export interface IndexStats {
  totalDocuments: number
  totalChunks: number
  indexedExtensions: string[]
}

export class Indexer {
  private chunkStrategy: ChunkStrategy
  private hierarchicalStrategy?: HierarchicalChunkStrategy
  private embedder: ILLMProvider
  private vectorStore: IVectorStore
  private totalDocuments = 0
  private totalChunks = 0
  private indexedExtensions = new Set<string>()
  private codeParser?: TreeSitterParser
  private parentStorePath: string

  constructor(options: IndexOptions) {
    this.chunkStrategy = options.chunkStrategy ?? new FixedSizeChunkStrategy()
    this.hierarchicalStrategy = options.hierarchicalChunkStrategy
    this.embedder = options.embedder
    this.vectorStore = options.vectorStore
    this.parentStorePath = options.parentStorePath ?? join(process.cwd(), '.agenthood', 'chunks')
  }

  setParser(parser: TreeSitterParser): void {
    this.codeParser = parser
  }

  async indexDocument(filePath: string, content: string): Promise<void> {
    const ext = extname(filePath).toLowerCase()
    this.indexedExtensions.add(ext)

    const lang = languageFromFile(filePath)
    if (lang && this.codeParser) {
      await this.indexWithParser(filePath, content, lang)
      return
    }

    if (this.hierarchicalStrategy) {
      await this.indexWithHierarchy(filePath, content)
      return
    }

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

  private async indexWithHierarchy(filePath: string, content: string): Promise<void> {
    const { parents, children } = this.hierarchicalStrategy!.chunk(
      content,
      { filePath, startLine: 0, endLine: content.split('\n').length },
      { chunkSize: this.chunkStrategy ? undefined : 512, overlap: this.hierarchicalStrategy ? 64 : undefined },
    )

    if (children.length === 0 && parents.length === 0) return

    const childRecords: VectorRecord[] = []
    for (const child of children) {
      const vector = await this.embedder.embed(child.embeddingContent)
      childRecords.push({
        id: child.id,
        vector,
        metadata: {
          source: filePath,
          parentId: child.parentId,
          parentStartLine: child.parentMetadata.startLine,
          parentEndLine: child.parentMetadata.endLine,
          isChild: true,
        },
        content: child.content,
        createdAt: new Date(),
      })
    }

    if (childRecords.length > 0) {
      await this.vectorStore.add(childRecords)
    }

    this.storeParents(parents)

    this.totalDocuments++
    this.totalChunks += children.length
  }

  private storeParents(parents: ParentChunk[]): void {
    const storeDir = this.parentStorePath
    if (!existsSync(storeDir)) {
      mkdirSync(storeDir, { recursive: true })
    }

    const manifestPath = join(storeDir, 'parents.json')
    let manifest: Record<string, ParentChunk> = {}

    if (existsSync(manifestPath)) {
      try {
        manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
      } catch {
        manifest = {}
      }
    }

    for (const parent of parents) {
      manifest[parent.id] = parent
    }

    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8')
  }

  private async indexWithParser(filePath: string, content: string, lang: string): Promise<void> {
    const entities = this.codeParser!.parse(content, lang as never, filePath)
    const combined = entities.map((e) => `${e.type} ${e.name} (lines ${e.startLine}-${e.endLine})`).join("\n")
    const vector = await this.embedder.embed(combined)

    await this.vectorStore.add([{
      id: `${filePath}::code-summary`,
      vector,
      metadata: {
        source: filePath,
        parser: "tree-sitter",
        entityCount: entities.length,
        entityTypes: [...new Set(entities.map((e) => e.type))],
      },
      content: `Code entities in ${filePath}:\n${combined}`,
      createdAt: new Date(),
    }])

    this.totalDocuments++
    this.totalChunks += entities.length
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
