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
import { stripFrontmatter, extractFrontmatterField } from '../agents/memberLore.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const SOCIETY_ROOT = join(__dirname, '..', '..')
export const MEMBERS_DIR = join(SOCIETY_ROOT, 'skills')

const SHARED_STYLE_PATH = join(MEMBERS_DIR, '_shared', 'CONVERSATIONAL-STYLE.md')
export const sharedConversationalStyle = existsSync(SHARED_STYLE_PATH)
  ? readFileSync(SHARED_STYLE_PATH, 'utf-8').trim()
  : ''

export class MemberNotFoundError extends Error {
  constructor(name: string) {
    super(`Member not found: "${name}"`)
    this.name = 'MemberNotFoundError'
  }
}

export class MemberRegistry {
  private specs: Map<string, MemberSpec> = new Map()
  /** Backward-compat aliases: old "the-*" names -> new names. */
  private static readonly ALIASES: Record<string, string> = {
    'the-scribe': 'scribe',
    'the-architect': 'architect',
    'the-builder': 'builder',
    'the-reviewer': 'reviewer',
    'the-tester': 'tester',
    'the-debugger': 'debugger',
    'the-auditor': 'auditor',
    'the-herald': 'herald',
    'the-librarian': 'librarian',
    'the-doorman': 'doorman',
    'the-oracle': 'oracle',
    'the-envoy': 'envoy',
    'the-sentinel': 'sentinel',
    'the-warden': 'warden',
    'the-strategist': 'strategist',
    'the-steward': 'steward',
    'the-operator': 'operator',
    'the-mediator': 'mediator',
    'the-mailman': 'mailman',
    'the-inspector': 'inspector',
  }

  constructor() {
    for (const raw of rawSpecs) {
      const skillPath = join(MEMBERS_DIR, raw.name, 'SKILL.md')
      let systemPrompt = ''
      let outputFormat: string | undefined
      let outputFormatMode: 'strict' | 'lenient' | undefined
      let allowedTools: string | undefined

      if (existsSync(skillPath)) {
        const content = readFileSync(skillPath, 'utf-8')
        const body = stripFrontmatter(content).trim()
        systemPrompt = body
        outputFormat = extractFrontmatterField(content, 'output_format')
        outputFormatMode = extractFrontmatterField(content, 'output_format_mode') as 'strict' | 'lenient' | undefined
        allowedTools = extractFrontmatterField(content, 'allowed-tools')
      }

      this.specs.set(raw.name, {
        name: raw.name,
        description: raw.description,
        category: raw.category,
        tagline: raw.tagline,
        permissionProfile: raw.permissionProfile,
        preferredProvider: raw.preferredProvider,
        tools: allowedTools
          ? MemberRegistry.intersectDeclaredTools(allowedTools, raw.permissionProfile)
          : this.defaultTools(raw.permissionProfile),
        systemPrompt,
        sourcePath: skillPath,
        canDelegate: raw.canDelegate,
        output_format: outputFormat,
        output_format_mode: outputFormatMode,
      })
    }
  }

  private resolveName(name: string): string {
    return MemberRegistry.ALIASES[name] ?? name
  }

  get(name: string): MemberSpec {
    const canonical = this.resolveName(name)
    const spec = this.specs.get(canonical)
    if (!spec) throw new MemberNotFoundError(name)
    return spec
  }

  has(name: string): boolean {
    return this.specs.has(this.resolveName(name))
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

  /** SKILL.md allowed-tools may only narrow, never expand: declared ∩ profile. */
  static intersectDeclaredTools(declared: string, permission: PermissionProfile): string[] {
    const set = new Set(declared.split(/\s+/).filter(Boolean))
    return MemberRegistry.toolsByProfile[permission].filter((t) => set.has(t))
  }
}
