import { describe, it, expect } from 'vitest'
import { CodeHierarchicalChunkStrategy, MarkdownHierarchicalChunkStrategy } from '../../../src/rag/ChunkStrategy.js'

describe('CodeHierarchicalChunkStrategy', () => {
  const strategy = new CodeHierarchicalChunkStrategy()
  const meta = { filePath: 'test.ts', startLine: 0, endLine: 50 }

  it('splits code into parents with structural blocks', () => {
    const text = [
      'import { foo } from "bar"',
      '',
      'export class MyClass {',
      '  private name: string',
      '  constructor(name: string) { this.name = name }',
      '}',
      '',
      'function helper() {',
      '  return 42',
      '}',
      '',
      'const VALUE = "constant"',
    ].join('\n')

    const { parents, children } = strategy.chunk(text, meta)

    expect(parents.length).toBe(1)
    expect(children.length).toBeGreaterThan(0)
  })

  it('returns empty for empty text', () => {
    const { parents, children } = strategy.chunk('', meta)

    expect(parents).toHaveLength(0)
    expect(children).toHaveLength(0)
  })

  it('produces child chunks with parentId and parentMetadata', () => {
    const text = 'class Foo { bar() {} }'
    const { parents, children } = strategy.chunk(text, meta)

    expect(parents.length).toBe(1)
    expect(children.length).toBeGreaterThan(0)
    for (const child of children) {
      expect(child.parentId).toBe(parents[0].id)
      expect(child.parentMetadata.filePath).toBe('test.ts')
    }
  })
})

describe('MarkdownHierarchicalChunkStrategy with H1 headings', () => {
  const strategy = new MarkdownHierarchicalChunkStrategy()
  const meta = { filePath: 'test.md', startLine: 0, endLine: 20 }

  it('splits on # H1 headings', () => {
    const text = [
      '# Title',
      'Content under title.',
      '',
      '## Section',
      'Content under section.',
    ].join('\n')

    const { parents } = strategy.chunk(text, meta)

    expect(parents.length).toBe(2)
    expect(parents[0].content).toContain('# Title')
    expect(parents[1].content).toContain('## Section')
  })

  it('does not split on ### H3 headings', () => {
    const text = [
      '# Main',
      'Content.',
      '',
      '### Subsection',
      'Sub content.',
    ].join('\n')

    const { parents } = strategy.chunk(text, meta)

    expect(parents.length).toBe(1) // H3 should not split
    expect(parents[0].content).toContain('### Subsection') // H3 content stays in parent
  })
})
