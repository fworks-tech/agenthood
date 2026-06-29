import { readdirSync, watch as fsWatch } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { ISkill } from './ISkill.js'
import type { ToolSchema } from '../llm/types.js'

export class SkillNotFoundError extends Error {
  constructor(skillName: string) {
    super(`Skill not found: "${skillName}"`)
    this.name = 'SkillNotFoundError'
  }
}

function isSkillShape(module: unknown): module is ISkill {
  if (typeof module !== 'object' || module === null) return false
  const s = module as Record<string, unknown>
  return (
    typeof s.name === 'string' &&
    typeof s.description === 'string' &&
    typeof s.inputSchema === 'object' &&
    typeof s.execute === 'function'
  )
}

export class SkillRegistry {
  private skills = new Map<string, ISkill>()
  private watchers = new Set<() => void>()
  private discoveredDirs = new Set<string>()

  register(skill: ISkill): void {
    this.skills.set(skill.name, skill)
  }

  get(name: string): ISkill {
    const skill = this.skills.get(name)
    if (!skill) {
      throw new SkillNotFoundError(name)
    }
    return skill
  }

  getSchemas(): ToolSchema[] {
    const schemas: ToolSchema[] = []
    for (const skill of this.skills.values()) {
      schemas.push({
        name: skill.name,
        description: skill.description,
        inputSchema: skill.inputSchema,
      })
    }
    return schemas
  }

  has(name: string): boolean {
    return this.skills.has(name)
  }

  list(): ISkill[] {
    return Array.from(this.skills.values())
  }

  async discover(dir: string): Promise<ISkill[]> {
    const found: ISkill[] = []
    const entries = readdirSync(dir, { withFileTypes: true })

    const files: string[] = []
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const nested = await this.discover(fullPath)
        found.push(...nested)
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        files.push(fullPath)
      }
    }

    for (const filePath of files) {
      try {
        const mod = await import(pathToFileURL(filePath).href)
        for (const key of Object.keys(mod)) {
          const exported = mod[key]
          if (isSkillShape(exported)) {
            this.register(exported)
            found.push(exported)
          }
        }
      } catch {
        // Silently skip files that fail to import (e.g. non-skill modules)
      }
    }

    this.discoveredDirs.add(dir)
    return found
  }

  async watch(dir: string): Promise<void> {
    if (this.discoveredDirs.has(dir)) return

    await this.discover(dir)
    this.discoveredDirs.add(dir)

    const watcher = fsWatch(dir, { recursive: true }, async (eventType, filename) => {
      if (filename && (filename.endsWith('.js') || filename.endsWith('.ts'))) {
        const key = filename.replace(/\.(js|ts)$/, '').replace(/\\/g, '/').split('/').pop()!
        if (this.has(key)) {
          // Re-discover to pick up changes
          await this.discover(dir)
        }
      }
    })

    const cleanup = () => {
      watcher.close()
    }
    this.watchers.add(cleanup)
  }

  close(): void {
    for (const cleanup of this.watchers) {
      cleanup()
    }
    this.watchers.clear()
  }
}
