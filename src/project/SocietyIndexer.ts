import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import type { ILLMProvider } from "../llm/ILLMProvider.ts"
import type { IVectorStore } from "../memory/VectorStore.ts"
import type { KnowledgeGraphStore } from "../rag/KnowledgeGraphStore.ts"
import type { GraphEdge, GraphNode } from "../rag/KnowledgeGraphStore.ts"

export type IndexableEntity = "member" | "adr" | "convention"

export interface SocietyIndexOptions {
  basePath: string
  knowledgeGraph: KnowledgeGraphStore
  vectorStore?: IVectorStore
  embedder?: ILLMProvider
  entities?: IndexableEntity[]
}

export class SocietyIndexer {
  private basePath: string
  private knowledgeGraph: KnowledgeGraphStore
  private vectorStore?: IVectorStore
  private embedder?: ILLMProvider

  constructor(options: SocietyIndexOptions) {
    this.basePath = options.basePath
    this.knowledgeGraph = options.knowledgeGraph
    this.vectorStore = options.vectorStore
    this.embedder = options.embedder
  }

  async index(options?: { entities?: IndexableEntity[] }): Promise<void> {
    const entities = options?.entities ?? ["member", "adr", "convention"]

    if (entities.includes("member")) {
      this.indexMembers()
    }
    if (entities.includes("adr")) {
      this.indexADRs()
    }
    if (entities.includes("convention")) {
      this.indexConventions()
    }
  }

  private indexMembers(): void {
    const membersDir = join(this.basePath, "docs", "members")
    if (!existsSync(membersDir)) return

    let entries: string[]
    try {
      entries = readdirSync(membersDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
    } catch {
      return
    }

    for (const memberName of entries) {
      if (memberName.startsWith(".")) continue
      const skillPath = join(membersDir, memberName, "SKILL.md")
      if (!existsSync(skillPath)) continue

      let content = ""
      try {
        content = readFileSync(skillPath, "utf8")
      } catch {
        continue
      }

      const id = `member:${memberName}`
      this.addNodeSafe({
        id,
        type: "member",
        label: memberName,
        metadata: { source: skillPath, indexedAt: new Date().toISOString() },
      })

      this.maybeEmbed(id, content)
    }
  }

  private indexADRs(): void {
    const adrDir = join(this.basePath, "docs", "adr")
    if (!existsSync(adrDir)) return

    let files: string[]
    try {
      files = readdirSync(adrDir).filter((f) => f.endsWith(".md"))
    } catch {
      return
    }

    const adrNodes = new Map<string, { id: string; label: string; content: string; supersedes?: string }>()

    for (const file of files) {
      const content = readFileSync(join(adrDir, file), "utf8")
      const id = `adr:${file.replace(/\.md$/, "")}`
      const titleMatch = content.match(/^#\s+(.+)/m)
      const label = titleMatch ? titleMatch[1].trim() : file

      const supersedes = this.findSupersedes(content)

      this.addNodeSafe({
        id,
        type: "adr",
        label,
        metadata: { source: file, indexedAt: new Date().toISOString() },
      })

      adrNodes.set(id, { id, label, content, supersedes })
      this.maybeEmbed(id, content)
    }

    for (const [, node] of adrNodes) {
      if (node.supersedes) {
        const refMatch = node.supersedes.match(/ADR-(\d+)/i)
        if (refMatch) {
          const num = refMatch[1].padStart(3, "0")
          const targetId = [...adrNodes.keys()].find((id) =>
            id === `adr:ADR-${num}` || id.includes(`ADR-${num}`),
          )
          if (targetId) {
            this.addEdgeSafe({
              id: `edge:${node.id}-supersedes-${targetId}`,
              source: node.id,
              target: targetId,
              relation: "supersedes",
            })
          }
        }
      }
    }

    for (const file of files) {
      const content = readFileSync(join(adrDir, file), "utf8")
      this.indexADRLinks(file, content, adrNodes)
    }
  }

  private indexADRLinks(currentFile: string, content: string, adrNodes: Map<string, { id: string; label: string }>): void {
    const currentId = `adr:${currentFile.replace(/\.md$/, "")}`
    const refs = content.match(/ADR-\d+/gi) || []

    for (const ref of refs) {
      const num = ref.replace("ADR-", "").padStart(3, "0")
      const targetId = [...adrNodes.keys()].find((id) =>
        id === `adr:ADR-${num}` || id.includes(`ADR-${num}`),
      )

      if (targetId && targetId !== currentId) {
        this.addEdgeSafe({
          id: `edge:${currentId}-references-${targetId}`,
          source: currentId,
          target: targetId,
          relation: "references",
        })
      }
    }
  }

  private indexConventions(): void {
    const convDir = join(this.basePath, "docs", "conventions")
    if (!existsSync(convDir)) return

    let files: string[]
    try {
      files = readdirSync(convDir).filter((f) => f.endsWith(".md") || f === ".gitmessage" || f.endsWith(".ts"))
    } catch {
      return
    }

    for (const file of files) {
      const content = readFileSync(join(convDir, file), "utf8")
      const id = `convention:${file}`
      const label = file.replace(/\.(md|ts)$/, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

      this.addNodeSafe({
        id,
        type: "convention",
        label,
        metadata: { source: file, indexedAt: new Date().toISOString() },
      })

      this.maybeEmbed(id, content)
    }
  }

  private findSupersedes(content: string): string | undefined {
    const lines = content.split("\n")
    for (const line of lines) {
      const trimmed = line.trim().toLowerCase()
      if (trimmed.startsWith("superseded by") || trimmed.startsWith("supersedes")) {
        const match = line.match(/ADR-\d+/i)
        if (match) return match[0]
      }
    }

    const supersedesSection = content.match(/##\s+Supersedes\s*\n([^#]+)/i)
    if (supersedesSection) {
      const match = supersedesSection[1].match(/ADR-\d+/i)
      if (match) return match[0]
    }

    return undefined
  }

  private addNodeSafe(node: GraphNode): void {
    try {
      this.knowledgeGraph.addNode(node)
    } catch {
      // node already exists
    }
  }

  private addEdgeSafe(edge: GraphEdge): void {
    try {
      this.knowledgeGraph.addEdge(edge)
    } catch {
      // edge already exists or nodes not found
    }
  }

  private maybeEmbed(id: string, content: string): void {
    if (!this.vectorStore || !this.embedder) return
    this.embedder.embed(content.slice(0, 8000)).then((vector) => {
      this.vectorStore!.add([{
        id: `${id}::content`,
        vector,
        metadata: { source: id, indexedAt: new Date().toISOString() },
        content: content.slice(0, 4000),
        createdAt: new Date(),
      }]).catch(() => {
        // embedding failure is non-critical
      })
    }).catch(() => {
      // embedding failure is non-critical
    })
  }

  stats(): { nodeCount: number; edgeCount: number } {
    return this.knowledgeGraph.stats()
  }
}
