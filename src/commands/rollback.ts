import { existsSync, readFileSync } from 'node:fs'
import type { CommandDescriptor } from './types.ts'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { contentHash } from '../utils/hash.ts'
import { MEMBER_NAME_RE } from '../members.ts'
import type { Lockfile } from '../utils/lockfile.ts'

function findRevision(cwd: string, skillPath: string, lockedHash: string): string | null {
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

function restoreMember(cwd: string, skillPath: string, member: string, commit: string, isDryRun: boolean): boolean {
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

  if (targetMember && !MEMBER_NAME_RE.test(targetMember)) {
    console.error(`Invalid member name: "${targetMember}"`)
    process.exit(1)
  }

  const lockPath = join(cwd, 'agenthood.lock')
  if (!existsSync(lockPath)) {
    console.error('Lockfile not found. Run `agenthood verify --update-lock` first.')
    process.exit(1)
  }

  let lock: Lockfile
  try {
    lock = JSON.parse(readFileSync(lockPath, 'utf8')) as Lockfile
  } catch {
    console.error('Invalid lockfile format.')
    process.exit(1)
  }

  if (targetMember && !lock.members[targetMember]) {
    console.error(`Member "${targetMember}" not found in lockfile.`)
    process.exit(1)
  }

  // lockfile keys are attacker-influenced (cloned repos) — validate every
  // key, not just the CLI arg, before it becomes a git pathspec
  const keys = Object.keys(lock.members).filter((m) => MEMBER_NAME_RE.test(m))
  const skipped = Object.keys(lock.members).filter((m) => !MEMBER_NAME_RE.test(m))
  for (const bad of skipped) {
    // JSON.stringify: hostile keys are attacker bytes — never echo them raw
    // (ANSI escape / newline spoofing in logs)
    console.warn(`Skipping invalid member key from lockfile: ${JSON.stringify(bad)}`)
  }

  const membersToRollback = targetMember ? [targetMember] : keys
  let hasRestoredAny = false

  for (const member of membersToRollback) {
    const skillPath = join('members', member, 'SKILL.md')
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


