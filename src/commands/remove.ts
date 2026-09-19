/**
 * agenthood remove <skill-name>
 *
 * The inverse of `install`: deletes an installed skill directory and its
 * skills-lock.json entry. Members are refused — they belong to deactivate/eject.
 */

import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { CommandDescriptor } from './types.ts'
import { resolveSkillsDir, SKILLS_LOCKFILE, MEMBER_NAMES } from '../members.ts'
import { SPEC_NAME_RE } from '../skills/discovery/SkillParser.ts'

export const command: CommandDescriptor = {
  name: 'remove',
  description: 'Remove an installed skill and its lockfile entry',
  handler: (args) => remove(args),
}

function removeLockEntry(lockPath: string, name: string): void {
  if (!existsSync(lockPath)) return
  try {
    const lock = JSON.parse(readFileSync(lockPath, 'utf-8')) as { skills?: Record<string, unknown> }
    if (lock.skills && name in lock.skills) {
      delete lock.skills[name]
      writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n', 'utf-8')
      console.log(`  ✓ Removed "${name}" from ${SKILLS_LOCKFILE}`)
    }
  } catch (err) {
    console.warn(`  Could not update ${SKILLS_LOCKFILE}: ${err instanceof Error ? err.message : err}`)
  }
}

export async function remove(args: string[]): Promise<void> {
  const dryRun = args.includes('--dry-run')
  const name = args.find((a) => !a.startsWith('--'))

  if (!name) {
    console.error('\nUsage: agenthood remove <skill-name> [--dry-run]\n')
    process.exit(1)
    return
  }

  // same spec-shaped gate as install — a hostile arg must not escape the skills dir
  if (!SPEC_NAME_RE.test(name)) {
    console.error(`  ✗ Invalid skill name "${name}" — must match ${SPEC_NAME_RE}`)
    process.exit(1)
    return
  }

  if (MEMBER_NAMES.includes(name)) {
    console.error(`  ✗ "${name}" is a Society member — use \`agenthood deactivate ${name}\` instead`)
    process.exit(1)
    return
  }

  const skillsDir = resolveSkillsDir(process.cwd())
  const skillDir = join(skillsDir, name)
  const lockPath = join(skillsDir, SKILLS_LOCKFILE)

  if (!existsSync(skillDir)) {
    console.error(`  ✗ Skill "${name}" is not installed in ${skillsDir}`)
    process.exit(1)
    return
  }

  if (dryRun) {
    console.log(`\n  Dry run — would remove ${skillDir} and its ${SKILLS_LOCKFILE} entry\n`)
    return
  }

  rmSync(skillDir, { recursive: true, force: true })
  console.log(`  ✓ Removed ${skillDir}`)
  removeLockEntry(lockPath, name)
  console.log()
}
