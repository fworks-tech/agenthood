/**
 * src/members/MemberRegistry.ts
 *
 * Canonical spec for all 14 Society members. This is the TypeScript runtime's
 * registry. Every member's
 * tool scope, permission profile, and preferred provider is defined here and
 * derived from the architecture docs.
 */

import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { MemberSpec, PermissionProfile, ProviderName, MemberCategory } from './types.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const SOCIETY_ROOT = join(__dirname, '..', '..')
const MEMBERS_DIR = join(SOCIETY_ROOT, 'members')

export class MemberNotFoundError extends Error {
  constructor(name: string) {
    super(`Member not found: "${name}"`)
    this.name = 'MemberNotFoundError'
  }
}

interface RawSpec {
  name: string
  description: string
  tagline: string
  category: MemberCategory
  permissionProfile: PermissionProfile
  preferredProvider: ProviderName
}

const rawSpecs: RawSpec[] = [
  {
    name: 'the-scribe',
    description: 'Writes conventional commit messages, PR descriptions, and changelogs',
    tagline: 'Commits, PRs, changelogs',
    category: 'engineering',
    permissionProfile: 'standard',
    preferredProvider: 'anthropic',
  },
  {
    name: 'the-architect',
    description: 'Drives spec-first development, task decomposition, and architecture decisions',
    tagline: 'Specs, planning, ADRs',
    category: 'engineering',
    permissionProfile: 'standard',
    preferredProvider: 'anthropic',
  },
  {
    name: 'the-reviewer',
    description: 'Conducts five-axis code review: correctness, security, performance, maintainability, test coverage',
    tagline: 'Five-axis code review',
    category: 'validation',
    permissionProfile: 'restricted',
    preferredProvider: 'anthropic',
  },
  {
    name: 'the-tester',
    description: 'Writes tests before implementation (TDD), maintains coverage targets, and validates acceptance criteria',
    tagline: 'TDD and test generation',
    category: 'engineering',
    permissionProfile: 'standard',
    preferredProvider: 'anthropic',
  },
  {
    name: 'the-debugger',
    description: 'Five-step debugging protocol: reproduce, isolate, hypothesize, test, fix',
    tagline: 'Root cause analysis',
    category: 'engineering',
    permissionProfile: 'standard',
    preferredProvider: 'anthropic',
  },
  {
    name: 'the-auditor',
    description: 'OWASP Top 10 security review, dependency audit, secrets scanning',
    tagline: 'Security and dependencies',
    category: 'validation',
    permissionProfile: 'restricted',
    preferredProvider: 'anthropic',
  },
  {
    name: 'the-herald',
    description: 'Manages semver determination, changelog generation, and release publishing',
    tagline: 'Releases and versioning',
    category: 'lifecycle',
    permissionProfile: 'standard',
    preferredProvider: 'anthropic',
  },
  {
    name: 'the-librarian',
    description: 'Keeps documentation synchronized with code changes',
    tagline: 'Documentation and ADRs',
    category: 'knowledge',
    permissionProfile: 'standard',
    preferredProvider: 'anthropic',
  },
  {
    name: 'the-doorman',
    description: 'Validates commit messages against conventional commit rules. Gatekeeps every commit',
    tagline: 'Validation and enforcement',
    category: 'validation',
    permissionProfile: 'restricted',
    preferredProvider: 'ollama',
  },
  {
    name: 'the-oracle',
    description: 'Cross-session institutional memory. Retrieves past decisions, patterns, and context',
    tagline: 'Research and knowledge',
    category: 'knowledge',
    permissionProfile: 'restricted',
    preferredProvider: 'anthropic',
  },
  {
    name: 'the-envoy',
    description: 'Cross-runtime translator. Adapts skills for non-Anthropic providers',
    tagline: 'Communication and handoffs',
    category: 'lifecycle',
    permissionProfile: 'restricted',
    preferredProvider: 'anthropic',
  },
  {
    name: 'the-sentinel',
    description: 'Guards quality standards: validates member schema, ADR presence, CI gate integrity',
    tagline: 'Member file validation',
    category: 'validation',
    permissionProfile: 'restricted',
    preferredProvider: 'anthropic',
  },
  {
    name: 'the-warden',
    description: 'Enforces project conventions: file naming, directory structure, import rules',
    tagline: 'File size enforcement',
    category: 'validation',
    permissionProfile: 'restricted',
    preferredProvider: 'anthropic',
  },
  {
    name: 'the-strategist',
    description: 'Translates ambiguous goals into structured problem statements, success criteria, and ranked priorities',
    tagline: 'Goal refinement and requirement discovery',
    category: 'engineering',
    permissionProfile: 'restricted',
    preferredProvider: 'anthropic',
  },
  {
    name: 'the-steward',
    description: 'Monitors context window capacity, routes tasks to the minimal required member set',
    tagline: 'Context and routing',
    category: 'lifecycle',
    permissionProfile: 'restricted',
    preferredProvider: 'groq',
  },
  {
    name: 'the-operator',
    description: 'Manages runtime health, deployment, incidents, rollback, and monitoring',
    tagline: 'Deployment, incidents, rollback',
    category: 'lifecycle',
    permissionProfile: 'restricted',
    preferredProvider: 'anthropic',
  },
]

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

  private defaultTools(permission: PermissionProfile): string[] {
    const base = ['file.read', 'file.list', 'file.search', 'code.grep', 'memory.read', 'memory.write', 'tasks.read', 'tasks.write', 'think']
    if (permission === 'restricted') return base

    const standard = [
      ...base,
      'file.write', 'file.edit',
      'git.status', 'git.diff', 'git.log', 'git.branch',
      'terminal.run',
    ]
    if (permission === 'standard') return standard

    return [
      ...standard,
      'file.delete',
      'git.commit', 'git.push', 'git.tag',
      'code.symbols', 'code.analysis', 'code.diagnostics',
      'search.web', 'search.vector', 'search.hybrid',
      'debug.stacktrace', 'debug.variables', 'debug.evaluate', 'debug.control',
    ]
  }
}
