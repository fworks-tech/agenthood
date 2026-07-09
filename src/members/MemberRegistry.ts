/**
 * src/members/MemberRegistry.ts
 *
 * Canonical spec for all Society members. This is the TypeScript runtime's
 * registry. Every member's
 * tool scope, permission profile, and preferred provider is defined here and
 * derived from the architecture docs.
 */

import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { MemberSpec, PermissionProfile, MemberCategory } from './types.ts'
import { rawSpecs } from './member-specs.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const SOCIETY_ROOT = join(__dirname, '..', '..')
const MEMBERS_DIR = join(SOCIETY_ROOT, 'skills')

export class MemberNotFoundError extends Error {
  constructor(name: string) {
    super(`Member not found: "${name}"`)
    this.name = 'MemberNotFoundError'
  }
}

export class MemberRegistry {
  private specs: Map<string, MemberSpec> = new Map()

  constructor() {
    for (const raw of rawSpecs) {
      const skillPath = join(MEMBERS_DIR, raw.name, 'SKILL.md')
      let systemPrompt = ''

      if (existsSync(skillPath)) {
        const content = readFileSync(skillPath, 'utf-8')
        // Strip YAML front-matter (--- ... ---) leaving only the prompt body
        const body = content.replace(/^---[\s\S]*?---\n*/, '').trim()
        systemPrompt = body
      }

      this.specs.set(raw.name, {
        name: raw.name,
        description: raw.description,
        category: raw.category,
        tagline: raw.tagline,
        permissionProfile: raw.permissionProfile,
        preferredProvider: raw.preferredProvider,
        tools: this.defaultTools(raw.permissionProfile),
        systemPrompt,
        sourcePath: skillPath,
      })
    }
  }

  get(name: string): MemberSpec {
    const spec = this.specs.get(name)
    if (!spec) throw new MemberNotFoundError(name)
    return spec
  }

  has(name: string): boolean {
    return this.specs.has(name)
  }

  list(): MemberSpec[] {
    return Array.from(this.specs.values())
  }

  listByCategory(category: MemberCategory): MemberSpec[] {
    return this.list().filter((s) => s.category === category)
  }

  private static readonly toolBase = [
    'file.read', 'file.list', 'file.search', 'code.grep', 'memory.read',
    'memory.write', 'tasks.read', 'tasks.write', 'think',
  ]

  private static readonly restrictedTools = [...MemberRegistry.toolBase]
  private static readonly standardTools = [
    ...MemberRegistry.restrictedTools,
    'file.write', 'file.edit',
    'git.status', 'git.diff', 'git.log', 'git.branch',
    'terminal.run',
  ]
  private static readonly trustedTools = [
    ...MemberRegistry.standardTools,
    'file.delete',
    'git.commit', 'git.push', 'git.tag',
    'code.symbols', 'code.analysis', 'code.diagnostics',
    'search.web', 'search.vector', 'search.hybrid',
    'debug.stacktrace', 'debug.variables', 'debug.evaluate', 'debug.control',
  ]

  private static readonly toolsByProfile: Record<PermissionProfile, string[]> = {
    restricted: MemberRegistry.restrictedTools,
    standard: MemberRegistry.standardTools,
    trusted: MemberRegistry.trustedTools,
  }

  private defaultTools(permission: PermissionProfile): string[] {
    return MemberRegistry.toolsByProfile[permission]
  }
}
