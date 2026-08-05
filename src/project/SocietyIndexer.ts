import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { MEMBER_NAMES } from "../members.ts"
import type { ILLMProvider } from "../llm/ILLMProvider.ts"
import type { IVectorStore } from "../memory/VectorStore.ts"
import type { KnowledgeGraphStore } from "../rag/KnowledgeGraphStore.ts"
import type { GraphEdge, GraphNode } from "../rag/KnowledgeGraphStore.ts"

export type IndexableEntity = "member" | "adr" | "convention"

interface AdrNode {
  id: string
  label: string
  content: string
  supersedes?: string
}

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
      await this.indexMembers()
    }
    if (entities.includes("adr")) {
      await this.indexADRs()
    }
    if (entities.includes("convention")) {
      await this.indexConventions()
    }
  }

  private async indexMembers(): Promise<void> {
    const membersDir = join(this.basePath, "skills")
    if (!existsSync(membersDir)) return

    let entries: string[]
    try {
      entries = readdirSync(membersDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
    } catch {
      return
    }

    // Only index the 19 canonical Society members; `skills/` also holds
    // non-member integration skills (aws, docker, github, ...) that are not members.
    const memberEntries = entries.filter((name) => MEMBER_NAMES.includes(name))
    const embedPromises: Promise<void>[] = []

    for (const memberName of memberEntries) {
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

      embedPromises.push(this.maybeEmbed(id, content))
    }

    await Promise.allSettled(embedPromises)
  }

  private async indexADRs(): Promise<void> {
    const adrDir = join(this.basePath, "docs", "adr")
    if (!existsSync(adrDir)) return

    let files: string[]
    try {
      files = readdirSync(adrDir).filter((f) => f.endsWith(".md"))
    } catch {
      return
    }

    const { nodes: adrNodes, embedPromises } = this.parseADRFiles(adrDir, files)
    this.resolveSupersedesEdges(adrNodes)
    this.indexADRReferences(adrDir, files, adrNodes)
    await Promise.allSettled(embedPromises)
  }

  private parseADRFiles(adrDir: string, files: string[]): { nodes: Map<string, AdrNode>; embedPromises: Promise<void>[] } {
    const adrNodes = new Map<string, AdrNode>()
    const embedPromises: Promise<void>[] = []

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
      embedPromises.push(this.maybeEmbed(id, content))
    }

    return { nodes: adrNodes, embedPromises }
  }

  private resolveSupersedesEdges(adrNodes: Map<string, AdrNode>): void {
    for (const node of adrNodes.values()) {
      if (!node.supersedes) continue

      const targetId = this.resolveAdrId(node.supersedes, adrNodes)
      if (!targetId) continue

      this.addEdgeSafe({
        id: `edge:${node.id}-supersedes-${targetId}`,
        source: node.id,
        target: targetId,
        relation: "supersedes",
      })
    }
  }

  private indexADRReferences(adrDir: string, files: string[], adrNodes: Map<string, AdrNode>): void {
    for (const file of files) {
      const content = readFileSync(join(adrDir, file), "utf8")
      const currentId = `adr:${file.replace(/\.md$/, "")}`

      for (const ref of content.match(/ADR-\d+/gi) || []) {
        const targetId = this.resolveAdrId(ref, adrNodes)
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
  }

  private resolveAdrId(ref: string, adrNodes: Map<string, AdrNode>): string | undefined {
    const refMatch = ref.match(/ADR-(\d+)/i)
    if (!refMatch) return undefined
    const num = refMatch[1].padStart(3, "0")
    return [...adrNodes.keys()].find((id) => id === `adr:ADR-${num}` || id.includes(`ADR-${num}`))
  }

  private async indexConventions(): Promise<void> {
    const convDir = join(this.basePath, "docs", "conventions")
    if (!existsSync(convDir)) return

    let files: string[]
    try {
      files = readdirSync(convDir).filter((f) => f.endsWith(".md") || f === ".gitmessage" || f.endsWith(".ts"))
    } catch {
      return
    }

    const embedPromises: Promise<void>[] = []

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

      embedPromises.push(this.maybeEmbed(id, content))
    }

    await Promise.allSettled(embedPromises)
  }

  private findSupersedes(content: string): string | undefined {
    const match = content.match(/supersed(?:ed by|es)[^#]*?(ADR-\d+)/is)
    return match ? match[1] : undefined
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

  private async maybeEmbed(id: string, content: string): Promise<void> {
    if (!this.vectorStore || !this.embedder) return
    try {
      const vector = await this.embedder.embed(content.slice(0, 8000))
      await this.vectorStore.add([{
        id: `${id}::content`,
        vector,
        metadata: { source: id, indexedAt: new Date().toISOString() },
        content: content.slice(0, 4000),
        createdAt: new Date(),
      }])
    } catch (err) {
      console.warn(`[SocietyIndexer] embedding failed for ${id}:`, err)
    }
  }

  stats(): { nodeCount: number; edgeCount: number } {
    return this.knowledgeGraph.stats()
  }
}
