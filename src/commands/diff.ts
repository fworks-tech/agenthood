import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import type { CommandDescriptor } from './types.ts'
import { resolveSocietyMembersDir, memberSkillPath } from '../members.ts'
import { contentHash } from '../utils/hash.ts'
import { findRevision } from './rollback.ts'
import { loadLockTargets } from './lockTargets.ts'

export const command: CommandDescriptor = {
  name: 'diff',
  description: 'Show member SKILL.md changes vs the versions locked in agenthood.lock',
  handler: (args) => diff(args),
}

/** Prints the diff for one member; returns true when it drifted from the lock. */
function showMemberDiff(cwd: string, member: string, lockedHash: string): boolean {
  const absPath = join(resolveSocietyMembersDir(), member, 'SKILL.md')
  const current = existsSync(absPath) ? readFileSync(absPath, 'utf-8') : ''
  if (contentHash(current) === lockedHash) return false

  const skillPath = memberSkillPath(cwd, member)
  const commit = findRevision(cwd, skillPath, lockedHash)
  if (!commit) {
    console.log(`\n  ? ${member} — locked version not found in git history`)
    return true
  }
  console.log(`\n  ${member} — working tree vs locked ${commit.slice(0, 12)}`)
  const out = execFileSync('git', ['diff', commit, '--', skillPath], { cwd, encoding: 'utf-8', stdio: 'pipe' }).trim()
  console.log(out || '    (no textual diff — content differs from the locked hash)')
  return true
}

export async function diff(args: string[]): Promise<void> {
  const cwd = process.cwd()
  const target = args.find((a) => !a.startsWith('--'))

  const { lock, members } = loadLockTargets(cwd, target, 'agenthood.lock not found. Run `agenthood verify --update-lock` first.')

  let drifted = 0
  for (const member of members) {
    const entry = lock.members[member]
    if (!entry) continue
    if (showMemberDiff(cwd, member, entry.version)) drifted++
  }

  if (drifted === 0) {
    console.log('\n  No differences vs agenthood.lock.\n')
    return
  }
  process.exit(1)
}
