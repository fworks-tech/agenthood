import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'

/**
 * Real grammar check — no mocks. TreeSitterParser.test.ts mocks the grammar
 * modules, so it proves routing but not that the pinned core actually loads
 * them. The core is held at 0.21.x because no single version satisfies all
 * three grammars' peer ranges, so a careless bump of any one of them fails
 * here (and in `npm ci`) instead of at parse time in production.
 */
const require = createRequire(import.meta.url)

const CASES: { language: string; module: string; property?: string; source: string; rootType: string }[] = [
  { language: 'go', module: 'tree-sitter-go', source: 'package main\nfunc main() {}\n', rootType: 'source_file' },
  { language: 'python', module: 'tree-sitter-python', source: 'def f():\n    return 1\n', rootType: 'module' },
  { language: 'typescript', module: 'tree-sitter-typescript', property: 'typescript', source: 'function f(): number { return 1 }\n', rootType: 'program' },
]

describe('tree-sitter grammar compatibility', () => {
  for (const testCase of CASES) {
    it(`parses ${testCase.language} with the pinned tree-sitter core`, () => {
      const Parser = require('tree-sitter')
      const grammar = require(testCase.module)
      const parser = new Parser()
      parser.setLanguage(testCase.property ? grammar[testCase.property] : grammar)

      const tree = parser.parse(testCase.source)
      expect(tree.rootNode.type).toBe(testCase.rootType)
      expect(tree.rootNode.namedChildCount).toBeGreaterThan(0)
    })
  }

  it('keeps the core on the 0.21 line the grammars peer on', () => {
    // Guards the pin in package.json: bumping core to 0.25 to adopt a newer
    // grammar breaks the other two, so the constraint must be checked here.
    expect(require('tree-sitter/package.json').version.startsWith('0.21.')).toBe(true)
    expect(require('tree-sitter-go/package.json').version).not.toMatch(/^0\.25/)
  })
})
