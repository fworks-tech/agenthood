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
