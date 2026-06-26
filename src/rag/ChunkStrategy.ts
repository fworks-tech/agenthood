export interface Chunk {
  content: string
  metadata: Record<string, unknown>
  startPos: number
  endPos: number
}

export interface ChunkOptions {
  chunkSize?: number
  overlap?: number
}

export interface CodeEntityStub {
  type: string
  name: string
  startLine: number
  endLine: number
}

export interface ChunkStrategy {
  chunk(text: string, options?: ChunkOptions): Chunk[]
}

export interface ParentChunk {
  id: string
  content: string
  metadata: { filePath: string; startLine: number; endLine: number }
  children: string[]
}

export interface ChildChunk {
  id: string
  content: string
  parentId: string
  parentMetadata: ParentChunk['metadata']
  embeddingContent: string
}

export interface HierarchicalChunkStrategy {
  chunk(text: string, metadata: { filePath: string; startLine: number; endLine: number }, options?: ChunkOptions): { parents: ParentChunk[]; children: ChildChunk[] }
}

const TOKEN_ESTIMATE_RATIO = 4

export class FixedSizeChunkStrategy implements ChunkStrategy {
  chunk(text: string, options?: ChunkOptions): Chunk[] {
    const chunkSize = options?.chunkSize ?? 512
    const overlap = options?.overlap ?? 64
    const effectiveOverlap = Math.min(overlap, chunkSize - 1)

    const avgCharsPerToken = TOKEN_ESTIMATE_RATIO
    const chunkChars = chunkSize * avgCharsPerToken
    const overlapChars = effectiveOverlap * avgCharsPerToken
    const step = chunkChars - overlapChars

    if (text.length === 0) return []

    const chunks: Chunk[] = []
    let start = 0

    while (start < text.length) {
      const end = Math.min(start + chunkChars, text.length)
      chunks.push({
        content: text.slice(start, end),
        metadata: { chunkIndex: chunks.length, estimatedTokens: Math.ceil((end - start) / avgCharsPerToken) },
        startPos: start,
        endPos: end,
      })
      if (end >= text.length) break
      start += step
    }

    return chunks
  }
}

export class MarkdownHierarchicalChunkStrategy implements HierarchicalChunkStrategy {
  private childChunker: FixedSizeChunkStrategy

  constructor() {
    this.childChunker = new FixedSizeChunkStrategy()
  }

  chunk(
    text: string,
    metadata: { filePath: string; startLine: number; endLine: number },
    options?: ChunkOptions,
  ): { parents: ParentChunk[]; children: ChildChunk[] } {
    if (text.length === 0) return { parents: [], children: [] }

    const childChunkSize = options?.chunkSize ? Math.floor(options.chunkSize / 4) : 128
    const childOverlap = options?.overlap ? Math.floor(options.overlap / 4) : 16
    const lines = text.split('\n')
    const sections = this.parseSections(lines)

    if (sections.length === 0) return { parents: [], children: [] }

    const parents: ParentChunk[] = []
    const children: ChildChunk[] = []

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i]
      const safePath = metadata.filePath.replace(/[\/\\]/g, '_')
      const parentId = `parent_${i}_${safePath}`
      const parentStartLine = metadata.startLine + section.headerLine
      const parentEndLine = metadata.startLine + section.endLine

      const parentMeta = {
        filePath: metadata.filePath,
        startLine: parentStartLine,
        endLine: parentEndLine,
      }

      const childChunks = this.childChunker.chunk(section.bodyText, {
        chunkSize: childChunkSize,
        overlap: childOverlap,
      })

      const childIds: string[] = []

      for (let j = 0; j < childChunks.length; j++) {
        const child = childChunks[j]
        const childId = `${parentId}_child_${j}`

        children.push({
          id: childId,
          content: child.content,
          parentId,
          parentMetadata: parentMeta,
          embeddingContent: child.content,
        })

        childIds.push(childId)
      }

      parents.push({
        id: parentId,
        content: section.fullText,
        metadata: parentMeta,
        children: childIds,
      })
    }

    return { parents, children }
  }

  private parseSections(lines: string[]): Array<{
    headerLine: number
    endLine: number
    heading: string
    bodyText: string
    fullText: string
  }> {
    const sections: Array<{ headerLine: number; endLine: number; heading: string; bodyText: string; fullText: string }> = []
    let currentSection: typeof sections[0] | null = null

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Match # or ## headings, but not ### (subsections)
      if ((line.startsWith('# ') || line.startsWith('## ')) && !line.startsWith('### ')) {
        if (currentSection) {
          currentSection.endLine = i - 1
          currentSection.fullText = lines.slice(currentSection.headerLine, i).join('\n')
          currentSection.bodyText = lines.slice(currentSection.headerLine + 1, i).join('\n')
          sections.push(currentSection)
        }

        currentSection = {
          headerLine: i,
          endLine: i,
          heading: line.replace(/^#+ /, '').trim(),
          bodyText: '',
          fullText: line,
        }
      }
    }

    if (currentSection) {
      currentSection.endLine = lines.length - 1
      currentSection.fullText = lines.slice(currentSection.headerLine).join('\n')
      currentSection.bodyText = lines.slice(currentSection.headerLine + 1).join('\n')
      sections.push(currentSection)
    }

    return sections
  }
}

export class CodeHierarchicalChunkStrategy implements HierarchicalChunkStrategy {
  private childChunker: FixedSizeChunkStrategy

  constructor() {
    this.childChunker = new FixedSizeChunkStrategy()
  }

  chunk(
    text: string,
    metadata: { filePath: string; startLine: number; endLine: number },
    options?: ChunkOptions,
  ): { parents: ParentChunk[]; children: ChildChunk[] } {
    if (text.length === 0) return { parents: [], children: [] }

    const childChunkSize = options?.chunkSize ? Math.floor(options.chunkSize / 4) : 128
    const childOverlap = options?.overlap ? Math.floor(options.overlap / 4) : 16
    const lines = text.split('\n')

    const parents: ParentChunk[] = []
    const children: ChildChunk[] = []

    // Treat entire file as a single parent section
    const safePath = metadata.filePath.replace(/[\/\\]/g, '_')
    const parentId = `code_parent_${safePath}`
    const parentMeta = { filePath: metadata.filePath, startLine: metadata.startLine, endLine: metadata.endLine }

    // Split code into logical blocks by top-level declarations
    const blocks = this.splitCodeBlocks(lines, metadata.filePath)

    let childIndex = 0
    const childIds: string[] = []

    for (const block of blocks) {
      const childChunks = this.childChunker.chunk(block.text, {
        chunkSize: childChunkSize,
        overlap: childOverlap,
      })

      for (const cc of childChunks) {
        const childId = `${parentId}_child_${childIndex++}`
        children.push({
          id: childId,
          content: cc.content,
          parentId,
          parentMetadata: parentMeta,
          embeddingContent: cc.content,
        })
        childIds.push(childId)
      }
    }

    parents.push({
      id: parentId,
      content: text,
      metadata: parentMeta,
      children: childIds,
    })

    return { parents, children }
  }

  private splitCodeBlocks(lines: string[], filePath: string): Array<{ text: string; startLine: number; endLine: number }> {
    const ext = filePath.split('.').pop()?.toLowerCase()
    const blocks: Array<{ text: string; startLine: number; endLine: number }> = []

    let currentStart = 0
    let inBlock = false
    let blockStart = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()

      // Detect top-level declarations based on language
      const isTopLevelDecl = this.isTopLevelDeclaration(trimmed, ext)

      if (isTopLevelDecl) {
        if (inBlock) {
          blocks.push({
            text: lines.slice(blockStart, i).join('\n'),
            startLine: blockStart,
            endLine: i - 1,
          })
        }
        inBlock = true
        blockStart = i
      }
    }

    if (inBlock) {
      blocks.push({
        text: lines.slice(blockStart).join('\n'),
        startLine: blockStart,
        endLine: lines.length - 1,
      })
    }

    // If no blocks found, treat whole file as one block
    if (blocks.length === 0 && lines.length > 0) {
      blocks.push({
        text: lines.join('\n'),
        startLine: 0,
        endLine: lines.length - 1,
      })
    }

    return blocks
  }

  private isTopLevelDeclaration(trimmed: string, ext?: string): boolean {
    const keywords = ['class ', 'function ', 'async function', 'export ', 'interface ',
      'type ', 'const ', 'let ', 'var ', 'def ', 'async def', 'func ',
      'impl ', 'struct ', 'enum ', 'trait ']

    for (const kw of keywords) {
      if (trimmed.startsWith(kw) || trimmed === kw.trim()) {
        return true
      }
    }

    return false
  }
}
