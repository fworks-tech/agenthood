import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

export interface DecisionEntry {
  id: string
  timestamp: string
  member: string
  task: string
  decision: string
  rationale: string
  alternatives: Array<{ option: string; reason: string }>
  outcome: string
  tags: string[]
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

  constructor(options: DecisionLogOptions = {}) {
    this.decisionsDir = options.decisionsDir ?? join(process.cwd(), '.agenthood', 'decisions')
    this.ensureDir()
  }

  async record(entry: DecisionEntry): Promise<void> {
    const filePath = join(this.decisionsDir, `${entry.id}.json`)
    this.ensureDir()
    writeFileSync(filePath, JSON.stringify(entry, null, 2), 'utf8')
    this.cache.set(entry.id, entry)
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

  async get(id: string): Promise<DecisionEntry | undefined> {
    if (this.cache.has(id)) return this.cache.get(id)

    const filePath = join(this.decisionsDir, `${id}.json`)
    if (!existsSync(filePath)) return undefined

    const raw = readFileSync(filePath, 'utf8')
    const entry = JSON.parse(raw) as DecisionEntry
    this.cache.set(id, entry)
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
    const files = readdirSync(this.decisionsDir).filter((f) => f.endsWith('.json'))
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

  private ensureDir(): void {
    if (!existsSync(this.decisionsDir)) {
      mkdirSync(this.decisionsDir, { recursive: true })
    }
  }
}
