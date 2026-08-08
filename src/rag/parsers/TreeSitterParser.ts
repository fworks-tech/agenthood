export type CodeEntityType = 'function' | 'class' | 'method' | 'import' | 'export' | 'interface' | 'type'

export interface CodeEntity {
  type: CodeEntityType
  name: string
  startLine: number
  endLine: number
  filePath: string
  dependencies: string[]
}

export type SupportedLanguage = 'typescript' | 'javascript' | 'python' | 'go'

export interface IParser {
  parse(source: string, language: SupportedLanguage, filePath: string): CodeEntity[]
}

const LANGUAGE_MAP: Record<SupportedLanguage, string[]> = {
  typescript: ['.ts', '.tsx', '.mts', '.cts'],
  javascript: ['.js', '.jsx', '.mjs', '.cjs'],
  python: ['.py'],
  go: ['.go'],
}

/** Grammar module name per supported language (require()d once in init()). */
const GRAMMAR_MODULES: Record<Exclude<SupportedLanguage, 'javascript'>, string> = {
  typescript: 'tree-sitter-typescript',
  python: 'tree-sitter-python',
  go: 'tree-sitter-go',
}

/**
 * tree-sitter core is pinned at 0.21.x on purpose: the published
 * tree-sitter-typescript grammar (latest 0.23.2) peers on `tree-sitter ^0.21.0`,
 * while tree-sitter-python/go 0.25.0 require `^0.25.0` core — no single core
 * version satisfies both. Upgrading core would break TypeScript parsing.
 */
const CORE_MODULE = 'tree-sitter'

function extname(filePath: string): string {
  const dot = filePath.lastIndexOf('.')
  return dot >= 0 ? filePath.slice(dot).toLowerCase() : ''
}

export function languageFromFile(filePath: string): SupportedLanguage | null {
  const ext = extname(filePath)
  for (const [lang, exts] of Object.entries(LANGUAGE_MAP)) {
    if (exts.includes(ext)) return lang as SupportedLanguage
  }
  return null
}

interface TreeSitterNode {
  type: string
  text: string
  startPosition: { row: number; column: number }
  endPosition: { row: number; column: number }
  children: TreeSitterNode[]
  namedChildren: TreeSitterNode[]
}

interface TreeSitterTree {
  rootNode: TreeSitterNode
}

interface TreeSitterParserInstance {
  parse(source: string): TreeSitterTree
}

export class TreeSitterParser implements IParser {
  private parsers: Map<SupportedLanguage, TreeSitterParserInstance> = new Map()
  private ready = false

  constructor() {
    this.init()
  }

  private init(): void {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Parser = require(CORE_MODULE) as typeof import('tree-sitter')
    for (const [lang, mod] of Object.entries(GRAMMAR_MODULES) as Array<[SupportedLanguage, string]>) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const langModule = require(mod)
        const parser = new Parser()
        parser.setLanguage(langModule)
        this.parsers.set(lang, parser)
      } catch {
        // language parser not available — skip
      }
    }
    this.ready = this.parsers.size > 0
  }

  parse(source: string, language: SupportedLanguage, filePath: string): CodeEntity[] {
    const parser = this.parsers.get(language)
    if (!this.ready || !parser) {
      return this.fallbackParse(source, filePath)
    }

    try {
      const tree = parser.parse(source)
      const entities: CodeEntity[] = []
      this.walkTree(tree.rootNode, filePath, entities, new Set())
      return entities
    } catch {
      return this.fallbackParse(source, filePath)
    }
  }

  private walkTree(
    node: TreeSitterNode,
    filePath: string,
    entities: CodeEntity[],
    seen: Set<string>,
  ): void {
    const entityType = this.mapNodeType(node.type)
    if (entityType) {
      const key = `${node.type}:${node.startPosition.row}:${node.text.slice(0, 40)}`
      if (!seen.has(key)) {
        seen.add(key)
        entities.push({
          type: entityType,
          name: this.extractName(node),
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          filePath,
          dependencies: this.extractDependencies(node),
        })
      }
    }

    if (node.type === 'import_statement' || node.type === 'import_declaration') {
      const deps = this.extractDependencies(node)
      if (deps.length > 0) {
        const key = `import:${deps[0]}`
        if (!seen.has(key)) {
          seen.add(key)
          entities.push({
            type: 'import',
            name: deps[0],
            startLine: node.startPosition.row + 1,
            endLine: node.endPosition.row + 1,
            filePath,
            dependencies: deps,
          })
        }
      }
    }

    for (const child of node.namedChildren) {
      this.walkTree(child, filePath, entities, seen)
    }
  }

  private mapNodeType(type: string): CodeEntityType | null {
    const map: Record<string, CodeEntityType> = {
      function_declaration: 'function',
      function_definition: 'function',
      method_definition: 'method',
      class_declaration: 'class',
      class_definition: 'class',
      interface_declaration: 'interface',
      type_alias_declaration: 'type',
      export_statement: 'export',
      export_default_declaration: 'export',
    }
    return map[type] ?? null
  }

  private extractName(node: TreeSitterNode): string {
    for (const child of node.namedChildren) {
      if (child.type === 'identifier' || child.type === 'property_identifier'
        || child.type === 'type_identifier' || child.type === 'name') {
        return child.text
      }
    }
    if (node.type === 'method_definition') {
      for (const child of node.children) {
        if (child.type === 'property_identifier') return child.text
      }
    }
    const nameChild = node.namedChildren.find((c) =>
      ['name', 'identifier', 'property_identifier', 'type_identifier'].includes(c.type),
    )
    return nameChild ? nameChild.text : `anonymous_${node.type}`
  }

  private extractDependencies(node: TreeSitterNode): string[] {
    const deps: string[] = []
    if (node.type === 'import_statement' || node.type === 'import_declaration') {
      for (const child of node.children) {
        if (child.type === 'string' || child.type === 'string_literal') {
          deps.push(child.text.replace(/['"]/g, ''))
        }
      }
    }
    for (const child of node.namedChildren) {
      if (child.type === 'call_expression') {
        const fnName = child.namedChildren[0]?.text
        if (fnName && (fnName === 'require' || fnName === 'import')) {
          for (const arg of child.namedChildren) {
            if (arg.type === 'string' || arg.type === 'string_literal' || arg.type === 'template_string') {
              deps.push(arg.text.replace(/['"`]/g, ''))
            }
          }
        }
      }
    }
    return deps
  }

  private fallbackParse(source: string, filePath: string): CodeEntity[] {
    const entities: CodeEntity[] = []
    const lines = source.split('\n')
    const importRe = /^(?:import\s+(?:\w+\s*,?\s*)?(?:{[^}]*}\s*)?from\s+['"]([^'"]+)['"]|const\s+\w+\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\))/

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const importMatch = line.match(importRe)
      if (importMatch) {
        const dep = importMatch[1] || importMatch[2]
        entities.push({
          type: 'import',
          name: dep,
          startLine: i + 1,
          endLine: i + 1,
          filePath,
          dependencies: [dep],
        })
        continue
      }

      const declaration = this.matchDeclaration(line, i, lines, filePath)
      if (declaration) {
        entities.push(declaration)
        continue
      }

      if (line.trim().startsWith('export ')) {
        entities.push({
          type: 'export',
          name: line.trim().slice(7).split(/[\s({]/)[0] || 'default',
          startLine: i + 1,
          endLine: i + 1,
          filePath,
          dependencies: [],
        })
      }
    }

    return entities
  }

  private matchDeclaration(
    line: string,
    index: number,
    lines: string[],
    filePath: string,
  ): CodeEntity | null {
    const patterns: Array<[RegExp, CodeEntityType, boolean]> = [
      [/^(?:export\s+)?(?:async\s+)?function\s+(\w+)/, 'function', true],
      [/^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/, 'class', true],
      [/^(?:export\s+)?interface\s+(\w+)/, 'interface', true],
      [/^(?:export\s+)?type\s+(\w+)/, 'type', false],
    ]
    for (const [re, type, hasBlock] of patterns) {
      const match = line.match(re)
      if (!match) continue
      const endLine = hasBlock ? this.findBlockEnd(lines, index) : index + 1
      return {
        type,
        name: match[1],
        startLine: index + 1,
        endLine,
        filePath,
        dependencies: [],
      }
    }
    return null
  }

  private findBlockEnd(lines: string[], start: number): number {
    let depth = 0
    for (let i = start; i < lines.length; i++) {
      for (const ch of lines[i]) {
        if (ch === '{') depth++
        if (ch === '}') depth--
      }
      if (depth === 0 && lines[i].includes('}')) return i + 1
    }
    return lines.length
  }
}
