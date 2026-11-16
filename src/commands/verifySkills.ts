/**
 * Skill-level verify reports. The interface lint is advisory (#540, #547, #548);
 * the requirement check is mostly advisory too, except a dependency cycle,
 * which no run can activate and is therefore an error (ADR-037, #571).
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { SkillParser, parseDependencies, parseRequires, parseVariants } from '../skills/discovery/SkillParser.ts'
import type { SkillDependencies, SkillRequires } from '../skills/discovery/ISkillManifest.ts'
import { variantTarget } from '../skills/discovery/variants.ts'
import { lintScript } from '../skills/execution/lint.ts'
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
