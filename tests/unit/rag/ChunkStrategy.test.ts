import { describe, it, expect } from 'vitest'
import { FixedSizeChunkStrategy } from '../../../src/rag/ChunkStrategy.js'
import type { Chunk } from '../../../src/rag/ChunkStrategy.js'

describe('FixedSizeChunkStrategy', () => {
  const strategy = new FixedSizeChunkStrategy()

  it('splits text into chunks by configured token size', () => {
    const text = 'word '.repeat(2000)
    const chunks = strategy.chunk(text, { chunkSize: 500, overlap: 0 })
    expect(chunks.length).toBeGreaterThanOrEqual(1)
    expect(chunks[0].content.length).toBeLessThanOrEqual(500 * 4)
  })

  it('overlaps consecutive chunks by configured overlap amount', () => {
    const text = 'word '.repeat(2000)
    const chunks = strategy.chunk(text, { chunkSize: 500, overlap: 100 })
    const firstEnd = chunks[0].endPos
    const secondStart = chunks[1].startPos
    expect(secondStart).toBeLessThan(firstEnd)
  })

  it('returns empty array for empty text', () => {
    const chunks = strategy.chunk('')
    expect(chunks).toHaveLength(0)
  })

  it('returns a single chunk for short text', () => {
    const chunks = strategy.chunk('short text')
    expect(chunks).toHaveLength(1)
    expect(chunks[0].content).toBe('short text')
    expect(chunks[0].startPos).toBe(0)
    expect(chunks[0].endPos).toBe('short text'.length)
  })

  it('assigns correct metadata to each chunk', () => {
    const text = 'word '.repeat(2000)
    const chunks = strategy.chunk(text, { chunkSize: 300, overlap: 0 })
    chunks.forEach((chunk, i) => {
      expect(chunk.metadata.chunkIndex).toBe(i)
      expect(typeof chunk.metadata.estimatedTokens).toBe('number')
      expect(chunk.metadata.estimatedTokens).toBeGreaterThan(0)
    })
  })

  it('respects zero overlap', () => {
    const text = 'A'.repeat(5000)
    const chunks = strategy.chunk(text, { chunkSize: 200, overlap: 0 })
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i].startPos).toBe(chunks[i - 1].endPos)
    }
  })

  it('caps overlap to chunkSize - 1', () => {
    const text = 'A'.repeat(2000)
    const chunks = strategy.chunk(text, { chunkSize: 100, overlap: 200 })
    expect(chunks.length).toBeGreaterThan(1)
  })
})
