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

type LanguageModule = new () => { parser: unknown }

export class TreeSitterParser implements IParser {
  private parsers: Map<SupportedLanguage, unknown> = new Map()
  private ready = false

  constructor() {
    this.init()
  }

  private init(): void {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Parser = require('tree-sitter') as typeof import('tree-sitter')
      const parser = new Parser()
      const languages: Array<[SupportedLanguage, string]> = [
        ['typescript', 'tree-sitter-typescript'],
        ['python', 'tree-sitter-python'],
        ['go', 'tree-sitter-go'],
      ]
      for (const [lang, mod] of languages) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const langModule = require(mod) as LanguageModule
          parser.setLanguage(langModule)
          this.parsers.set(lang, parser)
        } catch {
          // language parser not available — skip
        }
      }
      this.ready = this.parsers.size > 0
    } catch {
      this.ready = false
    }
  }

  parse(source: string, language: SupportedLanguage, filePath: string): CodeEntity[] {
    if (!this.ready || !this.parsers.has(language)) {
      return this.fallbackParse(source, filePath)
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Parser = require('tree-sitter') as typeof import('tree-sitter')
      const parser = new Parser()
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const langModule = require(
        language === 'typescript' ? 'tree-sitter-typescript'
        : language === 'python' ? 'tree-sitter-python'
        : 'tree-sitter-go',
      ) as LanguageModule
      parser.setLanguage(langModule)
      const tree: TreeSitterTree = parser.parse(source)
      const entities: CodeEntity[] = []
      this.walkTree(tree.rootNode, source, filePath, entities, new Set())
      return entities
    } catch {
      return this.fallbackParse(source, filePath)
    }
  }

  private walkTree(
    node: TreeSitterNode,
    source: string,
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
          dependencies: this.extractDependencies(node, source),
        })
      }
    }

    if (node.type === 'import_statement' || node.type === 'import_declaration') {
      const deps = this.extractDependencies(node, source)
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
      this.walkTree(child, source, filePath, entities, seen)
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

  private extractDependencies(node: TreeSitterNode, _source: string): string[] {
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
    const funcRe = /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/
    const classRe = /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/
    const interfaceRe = /^(?:export\s+)?interface\s+(\w+)/
    const typeRe = /^(?:export\s+)?type\s+(\w+)/
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

      const funcMatch = line.match(funcRe)
      if (funcMatch) {
        entities.push({
          type: 'function',
          name: funcMatch[1],
          startLine: i + 1,
          endLine: this.findBlockEnd(lines, i),
          filePath,
          dependencies: [],
        })
        continue
      }

      const classMatch = line.match(classRe)
      if (classMatch) {
        entities.push({
          type: 'class',
          name: classMatch[1],
          startLine: i + 1,
          endLine: this.findBlockEnd(lines, i),
          filePath,
          dependencies: [],
        })
        continue
      }

      const interfaceMatch = line.match(interfaceRe)
      if (interfaceMatch) {
        entities.push({
          type: 'interface',
          name: interfaceMatch[1],
          startLine: i + 1,
          endLine: this.findBlockEnd(lines, i),
          filePath,
          dependencies: [],
        })
        continue
      }

      const typeMatch = line.match(typeRe)
      if (typeMatch) {
        entities.push({
          type: 'type',
          name: typeMatch[1],
          startLine: i + 1,
          endLine: i + 1,
          filePath,
          dependencies: [],
        })
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
