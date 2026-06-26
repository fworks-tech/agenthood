import { describe, it, expect } from 'vitest'
import { MarkdownHierarchicalChunkStrategy } from '../../../src/rag/ChunkStrategy.js'
import type { ParentChunk, ChildChunk } from '../../../src/rag/ChunkStrategy.js'

describe('MarkdownHierarchicalChunkStrategy', () => {
  const strategy = new MarkdownHierarchicalChunkStrategy()
  const meta = { filePath: 'test.md', startLine: 0, endLine: 100 }

  it('splits markdown into parent/child pairs by H2 sections', () => {
    const text = [
      '## Introduction',
      'This is the introduction.',
      'It describes the project goals.',
      '',
      '## Implementation',
      'The code uses TypeScript.',
      'It is structured around agents.',
    ].join('\n')

    const { parents, children } = strategy.chunk(text, meta)

    expect(parents.length).toBe(2)
    expect(parents[0].metadata.filePath).toBe('test.md')
    expect(parents[0].content).toContain('## Introduction')
    expect(parents[1].content).toContain('## Implementation')

    expect(children.length).toBeGreaterThan(0)
  })

  it('every child carries parentId and parentMetadata', () => {
    const text = [
      '## Features',
      'Paragraph one text goes here with enough words to form a child chunk.',
      'More text to ensure the child chunk is created properly.',
    ].join('\n')

    const { parents, children } = strategy.chunk(text, meta)

    expect(children.length).toBeGreaterThan(0)

    for (const child of children) {
      expect(child.parentId).toBeTruthy()
      expect(child.parentMetadata).toBeDefined()
      expect(child.parentMetadata.filePath).toBe('test.md')
      expect(child.parentMetadata.startLine).toBe(meta.startLine)
    }
  })

  it('children reference correct parent IDs', () => {
    const text = [
      '## Section One',
      'Content for section one with multiple lines of body text.',
      'More content to ensure chunk creation works correctly.',
      '',
      '## Section Two',
      'Content for section two also with extended body text.',
      'Additional lines to fill out the section content.',
    ].join('\n')

    const { parents, children } = strategy.chunk(text, meta)

    expect(parents.length).toBe(2)

    for (const child of children) {
      const matchedParent = parents.find((p) => p.id === child.parentId)
      expect(matchedParent).toBeDefined()
    }
  })

  it('returns empty arrays for empty text', () => {
    const { parents, children } = strategy.chunk('', meta)

    expect(parents).toHaveLength(0)
    expect(children).toHaveLength(0)
  })

  it('returns single parent for single section', () => {
    const text = [
      '## API Reference',
      'The API provides the following endpoints.',
      'Each endpoint is documented below.',
    ].join('\n')

    const { parents, children } = strategy.chunk(text, meta)

    expect(parents.length).toBe(1)
    expect(parents[0].metadata.filePath).toBe('test.md')
    expect(parents[0].children.length).toBeGreaterThan(0)
  })

  it('parents contain full section text with heading', () => {
    const text = [
      '## Configuration',
      'The config file is located at .agenthood/config.json.',
      'It contains provider settings and member preferences.',
    ].join('\n')

    const { parents } = strategy.chunk(text, meta)

    expect(parents.length).toBe(1)
    expect(parents[0].content).toContain('## Configuration')
    expect(parents[0].content).toContain('.agenthood/config.json')
  })

  it('respects custom chunk size options', () => {
    const text = [
      '## Large Section',
      'Paragraph one. '.repeat(30),
      'Paragraph two. '.repeat(30),
    ].join('\n')

    const { children: smallChildren } = strategy.chunk(text, meta, { chunkSize: 512, overlap: 64 })
    const { children: tinyChildren } = strategy.chunk(text, meta, { chunkSize: 64, overlap: 16 })

    expect(tinyChildren.length).toBeGreaterThanOrEqual(smallChildren.length)
  })
})
