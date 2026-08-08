import { readFileSync, statSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { ISkillManifest } from './ISkillManifest.ts'

export interface ParsedSkill {
  name: string
  description: string
  body: string
}

export interface ParsedRaw {
  frontmatter: Record<string, unknown> | null
  body: string
}

export const MAX_SKILL_FILE_BYTES = 1024 * 1024

export class SkillParser {
  parse(filePath: string): ParsedSkill | null {
    if (!existsSync(filePath)) return null

    let size: number
    try {
      size = statSync(filePath).size
    } catch {
      return null
    }
    if (size > MAX_SKILL_FILE_BYTES) return null

    const content = readFileSync(filePath, 'utf-8')
    const raw = this.parseRaw(content)
    if (!raw.frontmatter) return null
    if (!raw.frontmatter.description) return null

    return {
      name: typeof raw.frontmatter.name === 'string' ? raw.frontmatter.name : filePath,
      description: typeof raw.frontmatter.description === 'string' ? raw.frontmatter.description : '',
      body: raw.body,
    }
  }

  /**
   * Extract raw frontmatter key-value pairs and body from a string.
   * Shared with verify.ts to avoid duplicated parsing logic.
   */
  parseRaw(content: string): ParsedRaw {
    const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
    if (!match) return { frontmatter: null, body: content }
    const frontmatter = this.parseYaml(match[1])
    return { frontmatter, body: match[2].trim() }
  }

  parseManifest(filePath: string, directory: string, body: string, name = '', description = ''): ISkillManifest {
    const resources: string[] = []
    try {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (entry.isDirectory() && (entry.name === 'references' || entry.name === 'scripts')) {
          for (const sub of readdirSync(join(directory, entry.name), { withFileTypes: true })) {
            if (sub.isFile()) {
              resources.push(`${entry.name}/${sub.name}`)
            }
          }
        }
      }
    } catch {
      // resources are best-effort
    }

    return {
      name,
      description,
      location: filePath,
      directory,
      body,
      resources,
    }
  }

  /**
   * Minimal frontmatter parser — flat key:value pairs only.
   *
   * **Limitations** (by design — SKILL.md frontmatter is intentionally simple):
   * - No YAML lists, nested objects, or multiline values
   * - No quoted-string handling (colons inside quoted values work; unquoted
   *   colons are treated as the key/value separator)
   * - No type coercion beyond true/false → boolean and digit strings → number
   */
  private parseYaml(raw: string): Record<string, unknown> | null {
    const result: Record<string, unknown> = {}
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const colonIdx = trimmed.indexOf(':')
      if (colonIdx === -1) continue
      const key = trimmed.slice(0, colonIdx).trim()
      let value: unknown = trimmed.slice(colonIdx + 1).trim()
      if (typeof value === 'string') {
        if (value === 'true') value = true
        else if (value === 'false') value = false
        else if (/^\d+$/.test(value)) value = Number(value)
        else if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
      }
      result[key] = value
    }
    return Object.keys(result).length > 0 ? result : null
  }
}
