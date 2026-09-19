import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import type { CommandDescriptor } from './types.ts'
import { MEMBER_NAME_RE, resolveSocietyMembersDir, memberSkillPath } from '../members.ts'
import { loadLockfile } from '../utils/lockfile.ts'
import { contentHash } from '../utils/hash.ts'
import { findRevision } from './rollback.ts'

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

  if (target && !MEMBER_NAME_RE.test(target)) {
    console.error(`Invalid member name: "${target}"`)
    process.exit(1)
  }

  const lock = loadLockfile(cwd)
  if (!lock) {
    console.error('agenthood.lock not found. Run `agenthood verify --update-lock` first.')
    process.exit(1)
  }

  if (target && !lock.members[target]) {
    console.error(`Member "${target}" not found in lockfile.`)
    process.exit(1)
  }

  // lockfile keys are attacker-influenced (cloned repos) — validate every
  // key before it becomes a git pathspec
  const keys = Object.keys(lock.members).filter((m) => MEMBER_NAME_RE.test(m))
  const skipped = Object.keys(lock.members).filter((m) => !MEMBER_NAME_RE.test(m))
  for (const bad of skipped) {
    // JSON.stringify: hostile keys are attacker bytes — never echo them raw
    console.warn(`Skipping invalid member key from lockfile: ${JSON.stringify(bad)}`)
  }
  const members = target ? [target] : keys

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
