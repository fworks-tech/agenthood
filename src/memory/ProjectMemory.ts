import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import type { KnowledgeGraphStore } from "../rag/KnowledgeGraphStore.ts"
import type { GraphNode } from "../rag/KnowledgeGraphStore.ts"

export class ProjectMemoryImpl {
  private projectPath: string
  private knowledgeGraph?: KnowledgeGraphStore

  constructor(projectPath: string, knowledgeGraph?: KnowledgeGraphStore) {
    this.projectPath = projectPath
    this.knowledgeGraph = knowledgeGraph
  }

  async getConventions(): Promise<GraphNode[]> {
    if (this.knowledgeGraph) {
      return this.knowledgeGraph.search("")
        .filter((n) => n.type === "convention")
    }

    const convDir = join(this.projectPath, "conventions")
    if (!existsSync(convDir)) return []

    try {
      const files = readdirSync(convDir)
      return files.map((f) => ({
        id: `convention:${f}`,
        type: "convention" as const,
        label: f,
        metadata: { source: f },
      }))
    } catch {
      return []
    }
  }

  async getArchitecturalDecisions(): Promise<GraphNode[]> {
    if (this.knowledgeGraph) {
      return this.knowledgeGraph.search("")
        .filter((n) => n.type === "adr")
    }

    const adrDir = join(this.projectPath, "docs", "adr")
    if (!existsSync(adrDir)) return []

    try {
      const files = readdirSync(adrDir).filter((f) => f.endsWith(".md"))
      return files.map((f) => ({
        id: `adr:${f.replace(/\.md$/, "")}`,
        type: "adr" as const,
        label: f.replace(/\.md$/, ""),
        metadata: { source: f },
      }))
    } catch {
      return []
    }
  }
}
