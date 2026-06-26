import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TreeSitterParser, languageFromFile } from '../../../src/rag/parsers/TreeSitterParser.js'
import type { CodeEntity } from '../../../src/rag/parsers/TreeSitterParser.js'

vi.mock('tree-sitter', () => {
  const MockNode = (type: string, text: string, row: number, children: unknown[] = []) => ({
    type,
    text,
    startPosition: { row, column: 0 },
    endPosition: { row: row + 1, column: text.length },
    children,
    namedChildren: children.filter((c: any) => !c.isExtra),
  })

  const mockParser = {
    setLanguage: vi.fn(),
    parse: vi.fn().mockReturnValue({
      rootNode: MockNode('program', '', 0, [
        MockNode('function_declaration', 'function hello() {}', 0, [
          { type: 'identifier', text: 'hello', startPosition: { row: 0, column: 9 }, endPosition: { row: 0, column: 14 }, children: [], namedChildren: [], isExtra: false },
        ]),
        MockNode('class_declaration', 'class MyClass {}', 2, [
          { type: 'identifier', text: 'MyClass', startPosition: { row: 2, column: 6 }, endPosition: { row: 2, column: 13 }, children: [], namedChildren: [], isExtra: false },
        ]),
        MockNode('import_statement', "import { foo } from 'bar'", 4, [
          { type: 'string', text: "'bar'", startPosition: { row: 4, column: 20 }, endPosition: { row: 4, column: 25 }, children: [], namedChildren: [], isExtra: false },
        ]),
      ]),
    }),
  }

  return {
    default: vi.fn(() => mockParser),
    __esModule: true,
  }
})

vi.mock('tree-sitter-typescript', () => ({ default: {} }))
vi.mock('tree-sitter-python', () => ({ default: {} }))
vi.mock('tree-sitter-go', () => ({ default: {} }))

describe('TreeSitterParser', () => {
  it('extracts functions, classes, and imports from TypeScript code', () => {
    const parser = new TreeSitterParser()
    const source = `
function hello() {}

class MyClass {}

import { foo } from 'bar'
`
    const entities = parser.parse(source, 'typescript', 'test.ts')
    expect(entities.length).toBeGreaterThanOrEqual(3)
    const funcs = entities.filter((e) => e.type === 'function')
    expect(funcs.length).toBeGreaterThanOrEqual(1)
    expect(funcs[0].name).toBe('hello')
    const classes = entities.filter((e) => e.type === 'class')
    expect(classes.length).toBeGreaterThanOrEqual(1)
    expect(classes[0].name).toBe('MyClass')
    const imports = entities.filter((e) => e.type === 'import')
    expect(imports.length).toBeGreaterThanOrEqual(1)
    expect(imports[0].name).toBe("bar")
  })

  it('returns entities with correct line numbers', () => {
    const parser = new TreeSitterParser()
    const source = `
function hello() {}
`
    const entities = parser.parse(source, 'typescript', 'test.ts')
    expect(entities.length).toBeGreaterThan(0)
    expect(entities[0].startLine).toBeGreaterThan(0)
    expect(entities[0].endLine).toBeGreaterThanOrEqual(entities[0].startLine)
  })

  it('attaches file path to each entity', () => {
    const parser = new TreeSitterParser()
    const entities = parser.parse('function foo() {}', 'typescript', 'src/index.ts')
    entities.forEach((e) => expect(e.filePath).toBe('src/index.ts'))
  })

  it('returns empty array for empty source', () => {
    const parser = new TreeSitterParser()
    const entities = parser.parse('', 'typescript', 'empty.ts')
    expect(Array.isArray(entities)).toBe(true)
  })
})

describe('languageFromFile', () => {
  it('identifies TypeScript from .ts extension', () => {
    expect(languageFromFile('file.ts')).toBe('typescript')
    expect(languageFromFile('file.tsx')).toBe('typescript')
  })

  it('identifies Python from .py extension', () => {
    expect(languageFromFile('file.py')).toBe('python')
  })

  it('identifies Go from .go extension', () => {
    expect(languageFromFile('file.go')).toBe('go')
  })

  it('returns null for unsupported extensions', () => {
    expect(languageFromFile('file.md')).toBeNull()
    expect(languageFromFile('file.json')).toBeNull()
  })
})
