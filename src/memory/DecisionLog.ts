import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { CausalRelationType, DecisionLogEntry as CoreDecisionLogEntry } from '../core/types.ts'

const EDGES_FILE = 'edges.json'

export interface DecisionEntry extends CoreDecisionLogEntry {
  confidence?: number
  decisionMaker?: string
  validFrom?: string
  validUntil?: string
  reasoningEmbedding?: number[]
}

export interface CausalEdge {
  id: string
  source: string
  target: string
  relationshipType: CausalRelationType
  timestamp: string
  metadata?: Record<string, unknown>
}

export interface DecisionSearchResult {
  entry: DecisionEntry
  score: number
  matchField: 'id' | 'member' | 'tag' | 'keyword'
}

export interface DecisionLogOptions {
  decisionsDir?: string
}

export class DecisionLog {
  private decisionsDir: string
  private cache: Map<string, DecisionEntry> = new Map()
  private edgesCache: CausalEdge[] | null = null

  constructor(options: DecisionLogOptions = {}) {
    this.decisionsDir = options.decisionsDir ?? join(process.cwd(), '.agenthood', 'decisions')
    this.ensureDir()
  }

  async record(entry: DecisionEntry): Promise<void> {
    const safeId = this.sanitizeId(entry.id)
    const filePath = join(this.decisionsDir, `${safeId}.json`)
    this.ensureDir()
    writeFileSync(filePath, JSON.stringify(entry, null, 2), 'utf8')
    this.cache.set(entry.id, entry)
  }

  async addCausalRelationship(sourceId: string, targetId: string, relationshipType: CausalRelationType): Promise<void> {
    const source = await this.get(sourceId)
    if (!source) throw new Error(`DecisionLog: source decision "${sourceId}" not found`)
    const target = await this.get(targetId)
    if (!target) throw new Error(`DecisionLog: target decision "${targetId}" not found`)

    const edges = this.loadEdges()
    const edge: CausalEdge = {
      id: `edge-${sourceId}-${targetId}-${relationshipType.toLowerCase()}`,
      source: sourceId,
      target: targetId,
      relationshipType,
      timestamp: new Date().toISOString(),
    }
    if (edges.some((e) => e.id === edge.id)) return
    edges.push(edge)
    this.saveEdges(edges)
  }

  async traceDecisionChain(id: string): Promise<DecisionEntry[]> {
    const start = await this.get(id)
    if (!start) return []
    const edges = this.loadEdges()
    const chain: DecisionEntry[] = []
    const visited = new Set<string>()

    const walk = async (nodeId: string): Promise<void> => {
      if (visited.has(nodeId)) return
      visited.add(nodeId)
      for (const edge of edges) {
        if (edge.target === nodeId) {
          await walk(edge.source)
        }
      }
      const entry = await this.get(nodeId)
      if (entry) chain.push(entry)
    }
    await walk(id)
    return chain
  }

  async analyzeDecisionImpact(id: string): Promise<DecisionEntry[]> {
    const start = await this.get(id)
    if (!start) return []
    const edges = this.loadEdges()
    const impacted: DecisionEntry[] = []
    const visited = new Set<string>([id])
    const queue = [id]

    while (queue.length > 0) {
      const nodeId = queue.shift()!
      for (const edge of edges) {
        if (edge.source === nodeId && !visited.has(edge.target)) {
          visited.add(edge.target)
          const entry = await this.get(edge.target)
          if (entry) impacted.push(entry)
          queue.push(edge.target)
        }
      }
    }
    return impacted
  }

  async search(query: string, filters?: { member?: string; tags?: string[] }): Promise<DecisionSearchResult[]> {
    this.loadCache()
    const results: DecisionSearchResult[] = []
    const lowerQuery = query.toLowerCase()

    for (const entry of this.cache.values()) {
      if (filters?.member && entry.member !== filters.member) continue
      if (filters?.tags && !filters.tags.some((t) => entry.tags.includes(t))) continue

      const match = this.matchEntry(entry, lowerQuery)
      if (match) results.push(match)
    }

    return results.sort((a, b) => b.score - a.score)
  }

  async recent(count: number = 10): Promise<DecisionEntry[]> {
    this.loadCache()
    return Array.from(this.cache.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, count)
  }

  async all(): Promise<DecisionEntry[]> {
    this.loadCache()
    return Array.from(this.cache.values())
  }

  async get(id: string): Promise<DecisionEntry | undefined> {
    const safeId = this.sanitizeId(id)
    if (this.cache.has(safeId)) return this.cache.get(safeId)

    const filePath = join(this.decisionsDir, `${safeId}.json`)
    if (!existsSync(filePath)) return undefined

    const raw = readFileSync(filePath, 'utf8')
    const entry = JSON.parse(raw) as DecisionEntry
    this.cache.set(safeId, entry)
    return entry
  }

  count(): number {
    return this.cache.size
  }

  private matchEntry(entry: DecisionEntry, query: string): DecisionSearchResult | null {
    const id = entry.id.toLowerCase()
    if (id === query) return { entry, score: 1.0, matchField: 'id' }

    if (entry.member.toLowerCase() === query) return { entry, score: 0.9, matchField: 'member' }

    const tagMatch = entry.tags.find((t) => t.toLowerCase() === query)
    if (tagMatch) return { entry, score: 0.8, matchField: 'tag' }

    const keywordFields = [entry.task, entry.decision, entry.rationale, entry.outcome].join(' ').toLowerCase()
    if (keywordFields.includes(query)) {
      const score = query.length / keywordFields.length
      return { entry, score: Math.min(score * 5, 0.7), matchField: 'keyword' }
    }

    return null
  }

  private loadCache(): void {
    if (!existsSync(this.decisionsDir)) return
    const files = readdirSync(this.decisionsDir).filter((f) => f.endsWith('.json') && f !== EDGES_FILE)
    for (const file of files) {
      const id = file.replace('.json', '')
      if (this.cache.has(id)) continue
      try {
        const raw = readFileSync(join(this.decisionsDir, file), 'utf8')
        const entry = JSON.parse(raw) as DecisionEntry
        this.cache.set(id, entry)
      } catch {
        // skip corrupt files
      }
    }
  }

  private loadEdges(): CausalEdge[] {
    if (this.edgesCache) return this.edgesCache
    const edgesPath = join(this.decisionsDir, EDGES_FILE)
    if (!existsSync(edgesPath)) {
      this.edgesCache = []
      return this.edgesCache
    }
    try {
      const raw = readFileSync(edgesPath, 'utf8')
      const data = JSON.parse(raw) as { edges: CausalEdge[] }
      this.edgesCache = Array.isArray(data.edges) ? data.edges : []
    } catch {
      this.edgesCache = []
    }
    return this.edgesCache
  }

  private saveEdges(edges: CausalEdge[]): void {
    this.edgesCache = edges
    const edgesPath = join(this.decisionsDir, EDGES_FILE)
    this.ensureDir()
    writeFileSync(edgesPath, JSON.stringify({ edges }, null, 2), 'utf8')
  }

  private sanitizeId(id: string): string {
    const safe = id.replace(/[^a-zA-Z0-9_-]/g, '')
    if (safe !== id) {
      throw new Error(`Invalid decision id: "${id}" — must match [a-zA-Z0-9_-]+`)
    }
    return safe
  }

  private ensureDir(): void {
    if (!existsSync(this.decisionsDir)) {
      mkdirSync(this.decisionsDir, { recursive: true })
    }
  }
}
