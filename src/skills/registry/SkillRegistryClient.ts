export interface SkillRegistryEntry {
  name: string
  description: string
  version: string
  author?: string
  tier?: string
  downloads?: number
  rating?: number
  publishedAt?: string
}

export interface SkillRegistrySearchResult {
  skills: SkillRegistryEntry[]
  total: number
  page: number
  pageSize: number
}

export class SkillRegistryClient {
  private readonly baseUrl: string

  constructor(baseUrl: string = 'https://registry.agenthood.dev') {
    this.baseUrl = baseUrl
  }

  async search(query: string, page = 1, pageSize = 20): Promise<SkillRegistrySearchResult> {
    const url = `${this.baseUrl}/api/skills/search?q=${encodeURIComponent(query)}&page=${page}&pageSize=${pageSize}`
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Registry search failed: ${response.statusText}`)
    }
    return await response.json() as SkillRegistrySearchResult
  }

  async get(name: string): Promise<SkillRegistryEntry | undefined> {
    const url = `${this.baseUrl}/api/skills/${encodeURIComponent(name)}`
    const response = await fetch(url)
    if (response.status === 404) return undefined
    if (!response.ok) {
      throw new Error(`Registry get failed: ${response.statusText}`)
    }
    return await response.json() as SkillRegistryEntry
  }

  async versions(name: string): Promise<string[]> {
    const url = `${this.baseUrl}/api/skills/${encodeURIComponent(name)}/versions`
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Registry versions failed: ${response.statusText}`)
    }
    const data = await response.json() as { versions: string[] }
    return data.versions
  }

  async download(name: string, version?: string): Promise<string> {
    const v = version ?? 'latest'
    const url = `${this.baseUrl}/api/skills/${encodeURIComponent(name)}/download/${v}`
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Registry download failed: ${response.statusText}`)
    }
    return await response.text()
  }
}
