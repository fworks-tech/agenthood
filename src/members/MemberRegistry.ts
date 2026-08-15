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
import { stripFrontmatter } from '../agents/memberLore.ts'

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
        const body = stripFrontmatter(content).trim()
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

  // Only tools TOOL_MAP can actually construct are advertised; listing a
  // tool here that MemberAgent cannot instantiate would silently drop it
  // from every member run (see MemberAgent.addTool).
  private static readonly toolsByProfile: Record<PermissionProfile, string[]> = (() => {
    const restricted = ['file.read', 'file.search', 'code.explain']
    const standard = [
      ...restricted,
      'file.write', 'code.write', 'code.refactor',
    ]
    const trusted = [
      ...standard,
      'pr_sync',
    ]
    return { restricted, standard, trusted }
  })()

  private defaultTools(permission: PermissionProfile): string[] {
    return MemberRegistry.toolsByProfile[permission]
  }
}
