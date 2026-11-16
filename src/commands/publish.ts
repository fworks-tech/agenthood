/**
 * agenthood publish
 *
 * Publish skills to a GitHub repository for skills.sh indexing.
 * Validates skills, checks git status, and pushes to remote.
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import type { CommandDescriptor } from './types.ts'
import { SkillDiscovery } from '../skills/discovery/SkillDiscovery.ts'
import { SkillParser, parseOwner, SPEC_NAME_RE } from '../skills/discovery/SkillParser.ts'
import { OWNER_RE } from '../skills/namespace.ts'

function hasRemote(): boolean {
  try {
    const remote = execSync('git remote get-url origin', { stdio: 'pipe', encoding: 'utf-8' }).trim()
    return remote.length > 0
  } catch {
    return false
  }
}

function isDirty(): boolean {
  try {
    const status = execSync('git status --porcelain', { stdio: 'pipe', encoding: 'utf-8' }).trim()
    return status.length > 0
  } catch {
    return false
  }
}

export function validateSkill(skillMdPath: string, fallbackOwner?: string): { ok: boolean; name?: string; owner?: string; error?: string } {
  const content = readFileSync(skillMdPath, 'utf-8')
  const parser = new SkillParser()
  const { frontmatter } = parser.parseRaw(content)

  if (!frontmatter || !frontmatter.name) {
    return { ok: false, error: 'missing "name" field in frontmatter' }
  }

  if (!frontmatter.description) {
    return { ok: false, name: String(frontmatter.name), error: 'missing "description" field in frontmatter' }
  }

  const name = String(frontmatter.name)
  if (!SPEC_NAME_RE.test(name)) {
    return { ok: false, name, error: `name "${name}" is not a valid skill name` }
  }

  // Publishing requires a namespace (#593, ADR-035 §1). Local-only skills stay
  // optional; a monorepo can pass one --author instead of editing every file.
  const owner = parseOwner(frontmatter) ?? fallbackOwner
  if (!owner) {
    return { ok: false, name, error: 'missing "metadata.author" — the registry namespace. Add it, or pass --author <owner>' }
  }
  if (!OWNER_RE.test(owner)) {
    return { ok: false, name, error: `metadata.author "${owner}" is not a valid namespace (lowercase letters, digits, single hyphens)` }
  }

  return { ok: true, name, owner }
}

/** `--author <owner>` or `--author=<owner>`. */
function readAuthor(args: string[]): string | undefined {
  const index = args.findIndex((arg) => arg === '--author' || arg.startsWith('--author='))
  if (index === -1) return undefined
  return (args[index].split('=')[1] ?? args[index + 1])?.trim()
}

export const command: CommandDescriptor = {
  name: 'publish',
  description: 'Publish skills to GitHub for skills.sh indexing (owner/name namespaces)',
  handler: (args) => publish(args),
}

export async function publish(args: string[]): Promise<void> {
  const dryRun = args.includes('--dry-run')
  const fallbackOwner = readAuthor(args)
  if (fallbackOwner !== undefined && !OWNER_RE.test(fallbackOwner)) {
    console.error(`\n  ✗ --author "${fallbackOwner}" is not a valid namespace (lowercase letters, digits, single hyphens).\n`)
    process.exit(1)
    return
  }
  const cwd = process.cwd()

  if (!existsSync(join(cwd, '.git'))) {
    console.error('\n  ✗ Not a git repository. Initialize with `git init` first.\n')
    process.exit(1)
    return
  }

  if (!hasRemote()) {
    console.error('\n  ✗ No git remote configured. Add one with `git remote add origin <url>`.\n')
    process.exit(1)
    return
  }

  const discovery = new SkillDiscovery()
  const skills = discovery.discover(cwd)

  if (skills.length === 0) {
    console.error('\n  ✗ No skills found in this project.\n')
    console.error('  Create a skill by adding a SKILL.md file to a directory under .agents/skills/\n')
    process.exit(1)
    return
  }

  console.log(`\n  Found ${skills.length} skill(s) to publish:\n`)

  let hasErrors = false
  const seen = new Map<string, string>()
  for (const skill of skills) {
    const skillMdPath = join(skill.directory, 'SKILL.md')
    const result = validateSkill(skillMdPath, fallbackOwner)

    if (result.ok) {
      const ref = `${result.owner}/${result.name}`
      const duplicate = seen.get(ref)
      if (duplicate) {
        console.error(`    ✗ ${ref}: also declared by ${duplicate} — registry names must be unique`)
        hasErrors = true
        continue
      }
      seen.set(ref, skill.directory)
      console.log(`    ✓ ${ref} (${skill.tier})`)
    } else {
      console.error(`    ✗ ${skill.directory}: ${result.error}`)
      hasErrors = true
    }
  }

  if (hasErrors) {
    console.error('\n  Fix validation errors before publishing.\n')
    process.exit(1)
    return
  }

  if (dryRun) {
    console.log('\n  Dry run — no changes made.\n')
    console.log('  To publish, push your skills to a GitHub repository:')
    console.log('    1. Ensure all SKILL.md files are committed')
    console.log('    2. Push to your GitHub repository')
    console.log('    3. Skills.sh will index them automatically\n')
    console.log('  Example:')
    console.log('    git add .agents/skills/')
    console.log('    git commit -m "feat(skills): publish to skills.sh"')
    console.log('    git push origin main\n')
    return
  }

  if (isDirty()) {
    console.error('\n  ✗ Working directory is dirty. Commit or stash changes first.\n')
    process.exit(1)
    return
  }

  console.log('\n  Publishing instructions:')
  console.log('    skills.sh indexes skills from GitHub repositories automatically.')
  console.log('    To publish your skills:\n')
  console.log('    1. Push this repository to GitHub')
  console.log('    2. Ensure SKILL.md files are in the repo root or .agents/skills/')
  console.log('    3. Skills.sh will discover and index them\n')
  console.log('  Your skills will be available at:')
  console.log('    https://skills.sh/<owner>/<repo>\n')
}
