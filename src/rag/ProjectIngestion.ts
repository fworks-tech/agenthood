import { readFileSync } from "node:fs"
import { readdirSync, statSync } from "node:fs"
import { extname, join, relative } from "node:path"
import type { Indexer } from "./Indexer.ts"
import type { KnowledgeGraphStore, GraphEdge, GraphNode } from "./KnowledgeGraphStore.ts"
import { TreeSitterParser, languageFromFile } from "./parsers/TreeSitterParser.ts"
import type { CodeEntity, SupportedLanguage } from "./parsers/TreeSitterParser.ts"

export class ProjectIngestion {
  private parser: TreeSitterParser

  constructor(parser?: TreeSitterParser) {
    this.parser = parser ?? new TreeSitterParser()
  }

  async ingest(projectPath: string, indexer: Indexer, knowledgeGraph: KnowledgeGraphStore): Promise<void> {
    this.walkAndProcess(projectPath, projectPath, indexer, knowledgeGraph)
  }

  private walkAndProcess(
    rootDir: string,
    currentDir: string,
    indexer: Indexer,
    knowledgeGraph: KnowledgeGraphStore,
  ): void {
    let entries: string[]
    try {
      entries = readdirSync(currentDir)
    } catch {
      return
    }

    for (const entry of entries) {
      const fullPath = join(currentDir, entry)
      let stat: ReturnType<typeof statSync>
      try {
        stat = statSync(fullPath)
      } catch {
        continue
      }

      if (stat.isDirectory()) {
        if (entry.startsWith(".") || entry === "node_modules" || entry === "dist") continue
        this.walkAndProcess(rootDir, fullPath, indexer, knowledgeGraph)
      } else if (stat.isFile()) {
        this.processFile(fullPath, rootDir, indexer, knowledgeGraph)
      }
    }
  }

  private processFile(
    filePath: string,
    rootDir: string,
    indexer: Indexer,
    knowledgeGraph: KnowledgeGraphStore,
  ): void {
    let content: string
    try {
      content = readFileSync(filePath, "utf8")
    } catch {
      return
    }

    const lang = languageFromFile(filePath)
    if (lang) {
      const entities = this.parser.parse(content, lang, filePath)
      this.indexEntities(entities, filePath, rootDir, indexer, knowledgeGraph)
    } else {
      const relPath = relative(rootDir, filePath)
      const nodeId = `file:${relPath}`
      try {
        knowledgeGraph.addNode({
          id: nodeId,
          type: "file",
          label: relPath,
          metadata: { path: filePath, ext: extname(filePath) },
        })
      } catch {
        // node already exists
      }
    }
  }

  private indexEntities(
    entities: CodeEntity[],
    filePath: string,
    rootDir: string,
    indexer: Indexer,
    knowledgeGraph: KnowledgeGraphStore,
  ): void {
    const relPath = relative(rootDir, filePath)

    for (const entity of entities) {
      const nodeId = `${entity.type}:${relPath}::${entity.name}`
      try {
        knowledgeGraph.addNode({
          id: nodeId,
          type: entity.type === "function" || entity.type === "class"
            || entity.type === "interface" || entity.type === "type"
            ? entity.type as GraphNode["type"]
            : "file",
          label: `${entity.name} (${relPath})`,
          metadata: {
            filePath: relPath,
            startLine: entity.startLine,
            endLine: entity.endLine,
            language: langFromExt(extname(filePath)),
          },
        })
      } catch {
        // node already exists — skip
      }
    }

    for (const entity of entities) {
      const sourceId = `${entity.type}:${relPath}::${entity.name}`
      for (const dep of entity.dependencies) {
        if (!dep.startsWith(".")) continue
        const targetId = `import:${relPath}::${dep}`
        try {
          knowledgeGraph.addNode({
            id: targetId,
            type: "file",
            label: `${dep} (${relPath})`,
            metadata: { filePath: relPath, resolvedFrom: dep },
          })
        } catch {
          // already exists
        }
        try {
          knowledgeGraph.addEdge({
            id: `edge:${sourceId}-imports-${targetId}`,
            source: sourceId,
            target: targetId,
            relation: "imports",
          })
        } catch {
          // edge already exists
        }
      }
    }
  }
}

function langFromExt(ext: string): string {
  const map: Record<string, string> = {
    ".ts": "TypeScript", ".tsx": "TypeScript JSX", ".js": "JavaScript",
    ".py": "Python", ".go": "Go",
  }
  return map[ext] ?? ext.slice(1)
}
