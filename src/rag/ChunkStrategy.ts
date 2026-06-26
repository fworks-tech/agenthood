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
      const parentId = `parent_${i}_${metadata.filePath.replace(/[^a-zA-Z0-9]/g, '_')}`
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

      if (line.startsWith('## ') && !line.startsWith('### ')) {
        if (currentSection) {
          currentSection.endLine = i - 1
          currentSection.fullText = lines.slice(currentSection.headerLine, i).join('\n')
          currentSection.bodyText = lines.slice(currentSection.headerLine + 1, i).join('\n')
          sections.push(currentSection)
        }

        currentSection = {
          headerLine: i,
          endLine: i,
          heading: line.slice(3).trim(),
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
