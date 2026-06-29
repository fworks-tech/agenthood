import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import type { ResidualMemory } from "./ResidualMemory.ts"
import type { TraceSignal } from "./ResidualMemory.ts"

export interface Preference {
  key: string
  value: string
  source: "explicit" | "inferred"
  confirmedAt: Date
}

const PREFERENCE_KEYS = ["style", "depth", "domain"] as const
type PreferenceKey = (typeof PREFERENCE_KEYS)[number]

export class PersonalisationStore {
  private preferences: Map<string, Preference> = new Map()
  private filePath?: string

  constructor(filePath?: string) {
    this.filePath = filePath
    if (filePath && existsSync(filePath)) {
      this.load(filePath)
    }
  }

  set(key: string, value: string, source: "explicit" | "inferred" = "explicit"): void {
    this.preferences.set(key, { key, value, source, confirmedAt: new Date() })
    this.maybeSave()
  }

  get(key: string): Preference | undefined {
    return this.preferences.get(key)
  }

  getAll(): Preference[] {
    return Array.from(this.preferences.values())
  }

  toPromptContext(): string {
    if (this.preferences.size === 0) return ""

    const parts: string[] = []
    for (const pref of this.preferences.values()) {
      parts.push(`- ${pref.key}: ${pref.value} (${pref.source})`)
    }
    return `Personalisation:\n${parts.join("\n")}`
  }

  inferFromResidualMemory(residualMemory: ResidualMemory, threshold: number = 0.7): void {
    const activeSignals = residualMemory.getActive(threshold)
    for (const signal of activeSignals) {
      for (const key of PREFERENCE_KEYS) {
        if (signal.pattern.toLowerCase().includes(key)) {
          const inferredValue = this.inferValue(signal, key)
          if (inferredValue && !this.preferences.has(key)) {
            this.set(key, inferredValue, "inferred")
          }
        }
      }
    }
  }

  private inferValue(signal: TraceSignal, key: PreferenceKey): string | null {
    const pattern = signal.pattern.toLowerCase()

    if (key === "style") {
      if (pattern.includes("concise") || pattern.includes("brief")) return "concise"
      if (pattern.includes("verbose") || pattern.includes("detailed")) return "verbose"
      if (pattern.includes("balanced")) return "balanced"
      return null
    }

    if (key === "depth") {
      if (pattern.includes("deep") || pattern.includes("thorough")) return "high"
      if (pattern.includes("shallow") || pattern.includes("quick")) return "low"
      return null
    }

    if (key === "domain") {
      const domains: Array<[string, string]> = [
        ["web", "web"],
        ["frontend", "web"],
        ["data", "data"],
        ["backend", "backend"],
        ["devops", "devops"],
        ["infra", "devops"],
        ["general", "general"],
        ["security", "security"],
      ]
      for (const [keyword, domain] of domains) {
        if (pattern.includes(keyword)) return domain
      }
      return null
    }

    return null
  }

  save(filePath: string): void {
    const dir = dirname(filePath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    writeFileSync(
      filePath,
      JSON.stringify({
        preferences: Array.from(this.preferences.values()),
      }, null, 2),
      "utf8",
    )
  }

  load(filePath: string): void {
    try {
      const raw = readFileSync(filePath, "utf8")
      const data: { preferences: Preference[] } = JSON.parse(raw)
      this.preferences.clear()
      for (const pref of data.preferences) {
        this.preferences.set(pref.key, {
          ...pref,
          confirmedAt: new Date(pref.confirmedAt),
        })
      }
    } catch {
      // corrupt or missing — start fresh
    }
  }

  clear(): void {
    this.preferences.clear()
  }

  private maybeSave(): void {
    if (this.filePath) {
      this.save(this.filePath)
    }
  }
}
