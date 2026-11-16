/**
 * Skill-level verify reports. The interface lint is advisory (#540, #547, #548);
 * the requirement check is mostly advisory too, except a dependency cycle,
 * which no run can activate and is therefore an error (ADR-037, #571).
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { SkillParser, parseDependencies, parseOwner, parseRequires, parseVariants } from '../skills/discovery/SkillParser.ts'
import type { SkillDependencies, SkillRequires } from '../skills/discovery/ISkillManifest.ts'
import { SkillDiscovery, userSkillDirs } from '../skills/discovery/SkillDiscovery.ts'
import { variantTarget } from '../skills/discovery/variants.ts'
import { lintScript } from '../skills/execution/lint.ts'
import { countTokens } from '../core/modelPricing.ts'
import { isKnownToolName } from '../members/toolVocabulary.ts'

export function reportScriptLint(membersDir: string): void {
  const findings = []
  for (const entry of readdirSync(membersDir, { withFileTypes: true }).filter((e) => e.isDirectory())) {
    const scriptsDir = join(membersDir, entry.name, 'scripts')
    if (!existsSync(scriptsDir)) continue
    for (const name of readdirSync(scriptsDir)) {
      const path = join(scriptsDir, name)
      if (!statSync(path).isFile()) continue
      findings.push(...lintScript(`${entry.name}/scripts/${name}`, readFileSync(path, 'utf8')))
    }
  }

  if (findings.length === 0) {
    console.log('  \u2713 Skill scripts: no interface warnings')
    return
  }
  console.log(`  ! Skill scripts: ${findings.length} warning(s) — advisory, not a failure`)
  for (const finding of findings) {
    console.log(`      - ${finding.script}: [${finding.rule}] ${finding.message}`)
  }
}

interface Declared {
  name: string
  directory: string
  location: string
  requires?: SkillRequires
  dependencies?: SkillDependencies
  variants?: Record<string, string>
}

function readDeclared(membersDir: string): Declared[] {
  const parser = new SkillParser()
  const declared: Declared[] = []
  let entries: string[]
  try {
    entries = readdirSync(membersDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  } catch {
    return []
  }
  for (const dir of entries) {
    const location = join(membersDir, dir, 'SKILL.md')
    if (!existsSync(location)) continue
    const { frontmatter } = parser.parseRaw(readFileSync(location, 'utf8'))
    declared.push({
      name: typeof frontmatter?.name === 'string' ? frontmatter.name : dir,
      directory: join(membersDir, dir),
      location,
      requires: parseRequires(frontmatter),
      dependencies: parseDependencies(frontmatter),
      variants: parseVariants(frontmatter),
    })
  }
  return declared
}

/** Cycles among required dependencies, as human-readable paths. */
function dependencyCycles(skills: Declared[], byName: Map<string, Declared>): string[] {
  const cycles = new Set<string>()
  const done = new Set<string>()
  const walk = (name: string, stack: string[]): void => {
    const at = stack.indexOf(name)
    if (at !== -1) {
      const path = [...stack.slice(at), name].join(' \u2192 ')
      cycles.add(path)
      return
    }
    if (done.has(name)) return
    done.add(name)
    for (const dependency of byName.get(name)?.dependencies?.required ?? []) {
      if (byName.has(dependency)) walk(dependency, [...stack, name])
    }
  }
  for (const skill of skills) walk(skill.name, [])
  return [...cycles]
}

/**
 * Checks requirement declarations against the skill set and the filesystem.
 * Returns false when a cycle exists — everything else is a warning, because a
 * missing tool may be supplied by an MCP server the operator has not started.
 */
export function reportSkillRequirements(membersDir: string): boolean {
  const skills = readDeclared(membersDir)
  const byName = new Map(skills.map((skill) => [skill.name, skill] as const))
  const warnings: string[] = []

  for (const skill of skills) {
    for (const tool of [...(skill.requires?.tools ?? []), ...(skill.requires?.optionalTools ?? [])]) {
      if (!tool.startsWith('mcp.') && !isKnownToolName(tool)) {
        warnings.push(`${skill.name}: unknown tool "${tool}" in requires.tools`)
      }
    }
    for (const dependency of [...(skill.dependencies?.required ?? []), ...(skill.dependencies?.optional ?? [])]) {
      if (!byName.has(dependency)) warnings.push(`${skill.name}: dependency "${dependency}" is not a skill in this set`)
    }
    for (const [fragment, path] of Object.entries(skill.variants ?? {})) {
      const { path: target, inside } = variantTarget(skill.directory, path)
      if (!inside) warnings.push(`${skill.name}: variant "${fragment}" points outside the skill directory (${path})`)
      else if (!existsSync(target)) warnings.push(`${skill.name}: variant "${fragment}" file not found (${path})`)
      else if (relative(skill.directory, target) === 'SKILL.md') {
        warnings.push(`${skill.name}: variant "${fragment}" shadows the default body (${path})`)
      }
    }
  }

  const cycles = dependencyCycles(skills, byName)
  for (const cycle of cycles) console.log(`  \u2717 Skill dependency cycle: ${cycle}`)

  if (warnings.length === 0) {
    console.log('  \u2713 Skill requirements: no unresolved declarations')
  } else {
    console.log(`  ! Skill requirements: ${warnings.length} warning(s) — advisory, not a failure`)
    for (const warning of warnings) console.log(`      - ${warning}`)
  }
  return cycles.length === 0
}

/** agentskills.io recommends <5000 tokens for a SKILL.md body (#615). */
export const DEFAULT_TOKEN_BUDGET = 5000

function parseTokenBudget(frontmatter: Record<string, unknown> | null): number | undefined {
  const raw = frontmatter?.['token-budget'] ?? frontmatter?.token_budget
  const value = typeof raw === 'string' ? Number(raw.trim()) : raw
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined
}

/**
 * Per-body token counts against the 5000-token guidance (#615). Advisory: an
 * over-budget body still works, it just spends context the task needed. The
 * suggestion is the one that actually helps — move the Process steps into
 * references/ and summarise them in the body.
 */
export function reportTokenBudgets(membersDir: string, defaultBudget = DEFAULT_TOKEN_BUDGET): void {
  const parser = new SkillParser()
  const rows: { name: string; tokens: number; budget: number }[] = []
  let dirs: string[]
  try {
    dirs = readdirSync(membersDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  } catch {
    return
  }
  for (const dir of dirs) {
    const location = join(membersDir, dir, 'SKILL.md')
    if (!existsSync(location)) continue
    const { frontmatter, body } = parser.parseRaw(readFileSync(location, 'utf8'))
    const name = typeof frontmatter?.name === 'string' ? frontmatter.name : dir
    rows.push({ name, tokens: countTokens(body), budget: parseTokenBudget(frontmatter) ?? defaultBudget })
  }

  const total = rows.reduce((sum, row) => sum + row.tokens, 0)
  const over = rows.filter((row) => row.tokens > row.budget)
  if (over.length === 0) {
    console.log(`  ✓ Skill token budgets: ${rows.length} bod(ies) within budget (total ${total} tokens)`)
    return
  }
  console.log(`  ! Skill token budgets: ${over.length} of ${rows.length} bod(ies) over budget — advisory, not a failure`)
  for (const row of over.sort((a, b) => b.tokens - a.tokens)) {
    console.log(`      - ${row.name}: ${row.tokens} tokens > ${row.budget} — move Process steps into references/ and summarise them`)
  }
  console.log(`      Total across all skills: ${total} tokens`)
}

export interface SkillRoot {
  path: string
  scope: 'user' | 'project'
}

/** Every search root, in the order discovery consults them (#616). */
export function skillSearchRoots(projectDir: string): SkillRoot[] {
  return [
    ...userSkillDirs().map((path) => ({ path, scope: 'user' as const })),
    { path: join(projectDir, '.agents', 'skills'), scope: 'project' },
    { path: join(projectDir, '.agenthood', 'skills'), scope: 'project' },
    { path: join(projectDir, '.claude', 'skills'), scope: 'project' },
    { path: join(projectDir, 'skills'), scope: 'project' },
  ]
}

/**
 * One skill name in several roots (#616). Runtime precedence already picks a
 * winner (project over user, earlier root over later), so this reports the
 * losers and the fix; it never moves a file.
 */
export function reportDuplicates(roots: SkillRoot[]): void {
  const byName = new Map<string, { directory: string; scope: 'user' | 'project' }[]>()
  for (const root of roots) {
    for (const manifest of new SkillDiscovery().scanRoot(root.path)) {
      const entries = byName.get(manifest.name) ?? []
      if (!entries.some((entry) => entry.directory === manifest.directory)) {
        entries.push({ directory: manifest.directory, scope: root.scope })
        byName.set(manifest.name, entries)
      }
    }
  }

  const duplicates = [...byName.entries()].filter(([, entries]) => entries.length > 1)
  if (duplicates.length === 0) {
    console.log('  ✓ Skill locations: no duplicate names across roots')
    return
  }
  console.log(`  ! Skill locations: ${duplicates.length} name(s) installed more than once — advisory, not a failure`)
  for (const [name, entries] of duplicates.sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`      - ${name} (${entries.length} copies)`)
    for (const entry of entries) console.log(`          ${entry.directory} (${entry.scope})`)
    console.log('          Keep the project copy and remove the user copy; the runtime already ignores the loser.')
  }
}

/**
 * Third-party skills declare where they came from (#154). Sentinel/CI checks
 * this path; an unowned contrib skill cannot be published or safely updated.
 */
export function reportContribSkills(projectPath: string): void {
  const root = join(projectPath, 'skills', 'contrib')
  if (!existsSync(root)) return

  const parser = new SkillParser()
  const problems: string[] = []
  let count = 0
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const location = join(root, entry.name, 'SKILL.md')
    if (!existsSync(location)) continue
    count++
    const { frontmatter } = parser.parseRaw(readFileSync(location, 'utf8'))
    if (!parseOwner(frontmatter)) {
      problems.push(`${entry.name}: missing metadata.author — the owner in owner/name`)
    }
    const source = frontmatter?.source_url ?? frontmatter?.sourceUrl
    if (typeof source !== 'string' || !source.trim()) {
      problems.push(`${entry.name}: missing source_url — where this skill came from`)
    }
  }

  if (count === 0) return
  if (problems.length === 0) {
    console.log(`  ✓ Contrib skills: ${count} third-party skill(s) named and sourced`)
    return
  }
  console.log(`  ⚠ Contrib skills: ${problems.length} problem(s) — advisory, not a failure`)
  for (const problem of problems) console.log(`      - ${problem}`)
}
