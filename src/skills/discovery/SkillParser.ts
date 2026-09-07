import { readFileSync, statSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { ISkillManifest, SkillTier } from './ISkillManifest.ts'

const VALID_TIERS: SkillTier[] = ['official', 'community', 'experimental']

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

// agentskills.io spec constraints. Enforced by `verify` (and any spec gate),
// NOT by parse(): parse() must stay permissive so third-party skills that
// don't follow the convention still load at runtime rather than silently
// vanishing from discovery.
const SPEC_NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
const MAX_NAME_LENGTH = 64
const MAX_DESCRIPTION_LENGTH = 1024

export interface SkillSpecError {
  rule: string
  message: string
  fix: string
}

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
    // Windows editors may prepend a UTF-8 BOM, which would stop the frontmatter
    // regex (anchored at ^) from matching — strip it here, the single parse chokepoint.
    if (content.charCodeAt(0) === 0xfeff) content = content.slice(1)
    const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
    if (!match) return { frontmatter: null, body: content }
    const frontmatter = this.parseYaml(match[1])
    return { frontmatter, body: match[2].trim() }
  }

  parseManifest(filePath: string, directory: string, body: string, name = '', description = '', tier: SkillTier = 'community'): ISkillManifest {
    const resources: string[] = []
    try {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (entry.isDirectory() && (entry.name === 'references' || entry.name === 'scripts')) {
          resources.push(...this.collectResources(join(directory, entry.name), entry.name))
        }
      }
    } catch (err) {
      if (isNonEnoentError(err)) {
        console.warn(`[SkillParser] error reading resource dirs in ${directory}:`, err)
      }
    }

    return {
      name,
      description,
      tier,
      location: filePath,
      directory,
      body,
      resources,
    }
  }

  private collectResources(dir: string, subdirName: string): string[] {
    const resources: string[] = []
    try {
      for (const sub of readdirSync(dir, { withFileTypes: true })) {
        if (sub.isFile()) {
          resources.push(`${subdirName}/${sub.name}`)
        }
      }
    } catch (err) {
      if (isNonEnoentError(err)) {
        console.warn(`[SkillParser] error reading ${dir}:`, err)
      }
    }
    return resources
  }

  /**
   * Parse and validate the `tier` field from frontmatter.
   * Returns 'community' if missing or invalid (safe default).
   */
  parseTier(frontmatter: Record<string, unknown> | null): SkillTier {
    if (!frontmatter || typeof frontmatter.tier !== 'string') return 'community'
    const raw = frontmatter.tier.toLowerCase()
    return VALID_TIERS.includes(raw as SkillTier) ? (raw as SkillTier) : 'community'
  }

  /**
   * Validate a skill against the agentskills.io naming/description spec.
   * Returns one error per violated rule (each with a concrete fix), or an
   * empty array when the skill is spec-compliant. `dirName` is the parent
   * directory the SKILL.md lives in; `fileName` the file's basename.
   */
  validateSpec(name: string, description: string, dirName: string, fileName = 'SKILL.md'): SkillSpecError[] {
    const errors: SkillSpecError[] = []
    if (!SPEC_NAME_RE.test(name)) {
      errors.push({
        rule: 'name-format',
        message: `name "${name}" is not lowercase alphanumeric with single hyphens`,
        fix: 'Use ^[a-z0-9]+(-[a-z0-9]+)*$ — e.g. "pdf-processing", no leading/trailing/consecutive hyphens or uppercase',
      })
    }
    if (name.length < 1 || name.length > MAX_NAME_LENGTH) {
      errors.push({
        rule: 'name-length',
        message: `name length ${name.length} is outside 1-${MAX_NAME_LENGTH}`,
        fix: `Shorten the name to at most ${MAX_NAME_LENGTH} characters`,
      })
    }
    if (description.length < 1 || description.length > MAX_DESCRIPTION_LENGTH) {
      errors.push({
        rule: 'description-length',
        message: `description length ${description.length} is outside 1-${MAX_DESCRIPTION_LENGTH}`,
        fix: `Keep the description between 1 and ${MAX_DESCRIPTION_LENGTH} characters`,
      })
    }
    if (name !== dirName) {
      errors.push({
        rule: 'name-directory-match',
        message: `name "${name}" does not match directory "${dirName}"`,
        fix: `Rename the directory to "${name}" or set the name to "${dirName}"`,
      })
    }
    if (fileName !== 'SKILL.md') {
      errors.push({
        rule: 'filename',
        message: `file "${fileName}" is not named SKILL.md`,
        fix: 'Rename the file to SKILL.md (exact case)',
      })
    }
    return errors
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

function isNonEnoentError(err: unknown): boolean {
  if (!(err instanceof Error)) return true
  const code = (err as NodeJS.ErrnoException).code
  return !code || code !== 'ENOENT'
}
