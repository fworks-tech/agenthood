import type { CommandDescriptor } from './types.ts'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { contentHash } from '../utils/hash.ts'
import { memberSkillPath } from '../members.ts'
import { loadLockTargets } from './lockTargets.ts'

export function findRevision(cwd: string, skillPath: string, lockedHash: string): string | null {
  let commits: string[]
  try {
    const output = execFileSync('git', ['log', '--all', '--pretty=format:%H', '--', skillPath], { cwd, encoding: 'utf-8', stdio: 'pipe' })
    commits = output.trim().split('\n').filter(Boolean)
  } catch {
    return null
  }

  for (const commit of commits) {
    const content = execFileSync('git', ['show', `${commit}:${skillPath}`], { cwd, encoding: 'utf-8', stdio: 'pipe' })
    const hash = contentHash(content)
    if (hash === lockedHash) return commit
  }
  return null
}

/**
 * Byte-exact revision lookup for a member resource file (#604). Resources are
 * locked with raw-byte SHA-256, so they cannot go through `findRevision`'s
 * utf8 string hash — that would corrupt binary scripts and reject valid text
 * files whose line endings differ between the blob and the working tree.
 */
export function findResourceRevision(cwd: string, relPath: string, lockedHash: string): string | null {
  let commits: string[]
  try {
    const output = execFileSync('git', ['log', '--all', '--pretty=format:%H', '--', relPath], { cwd, encoding: 'utf-8', stdio: 'pipe' })
    commits = output.trim().split('\n').filter(Boolean)
  } catch {
    return null
  }
  for (const commit of commits) {
    try {
      const blob = execFileSync('git', ['show', `${commit}:${relPath}`], { cwd, encoding: 'buffer', stdio: 'pipe' })
      if (createHash('sha256').update(blob).digest('hex') === lockedHash) return commit
    } catch {
      continue
    }
  }
  return null
}

export function restoreMember(cwd: string, skillPath: string, member: string, commit: string, isDryRun: boolean): boolean {
  if (isDryRun) {
    console.log(`  ~ ${member} — would restore from ${commit.slice(0, 12)}`)
    return true
  }

  try {
    execFileSync('git', ['checkout', commit, '--', skillPath], { cwd, encoding: 'utf-8', stdio: 'pipe' })
    console.log(`  \u2713 ${member} — restored from ${commit.slice(0, 12)}`)
    return true
  } catch {
    console.error(`  \u2717 ${member} — failed to restore from ${commit.slice(0, 12)}`)
    return false
  }
}

export const command: CommandDescriptor = {
  name: 'rollback',
  description: 'Restore member SKILL.md from lockfile',
  handler: (args) => rollback(args),
}

export async function rollback(args: string[]): Promise<void> {
  const cwd = process.cwd()
  const flags = new Set(args.filter((a) => a.startsWith('--')))
  const positionals = args.filter((a) => !a.startsWith('--'))

  const isDryRun = flags.has('--dry-run')
  const targetMember = positionals[0]

  const { lock, members: membersToRollback } = loadLockTargets(cwd, targetMember, 'Lockfile not found. Run `agenthood verify --update-lock` first.')
  let hasRestoredAny = false

  for (const member of membersToRollback) {
    // Same canonical member location as `verify` (#740) — forward-slash
    // relative path so `git show <rev>:<path>` accepts the blob syntax.
    const skillPath = memberSkillPath(cwd, member)
    const entry = lock.members[member]
    if (!entry) continue
    const lockedHash = entry.version

    const commit = findRevision(cwd, skillPath, lockedHash)
    if (!commit) {
      console.log(`  ? ${member} — no matching revision found in git history`)
      continue
    }

    hasRestoredAny = true
    restoreMember(cwd, skillPath, member, commit, isDryRun)
  }

  if (!hasRestoredAny) {
    console.error('No members could be restored.')
    process.exit(1)
  }
}


