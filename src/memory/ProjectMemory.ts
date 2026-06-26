import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import type { KnowledgeGraphStore } from "../rag/KnowledgeGraphStore.ts"
import type { GraphNode } from "../rag/KnowledgeGraphStore.ts"
import type { Convention } from "../core/types.js"

export class ProjectMemoryImpl {
  private projectPath: string
  private knowledgeGraph?: KnowledgeGraphStore

  constructor(projectPath: string, knowledgeGraph?: KnowledgeGraphStore) {
    this.projectPath = projectPath
    this.knowledgeGraph = knowledgeGraph
  }

  async getConventions(): Promise<Convention[]> {
    if (this.knowledgeGraph) {
      return this.knowledgeGraph.search("")
        .filter((n) => n.type === "convention")
        .map((n) => ({ name: n.label, value: String(n.metadata?.source ?? "") }))
    }

    const convDir = join(this.projectPath, "conventions")
    if (!existsSync(convDir)) return []

    try {
      const files = readdirSync(convDir)
      return files.map((f) => ({ name: f, value: "" }))
    } catch {
      return []
    }
  }

  async getArchitecturalDecisions(): Promise<string[]> {
    if (this.knowledgeGraph) {
      return this.knowledgeGraph.search("")
        .filter((n) => n.type === "adr")
        .map((n) => n.label)
    }

    const adrDir = join(this.projectPath, "docs", "adr")
    if (!existsSync(adrDir)) return []

    try {
      const files = readdirSync(adrDir).filter((f) => f.endsWith(".md"))
      return files.map((f) => f.replace(/\.md$/, ""))
    } catch {
      return []
    }
  }
}
