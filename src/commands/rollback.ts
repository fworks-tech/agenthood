import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import { contentHash } from '../utils/hash.js'
import type { Lockfile } from '../utils/lockfile.js'

function findRevision(cwd: string, skillPath: string, lockedHash: string): string | null {
  const gitCmd = `git log --all --pretty=format:"%H" -- "${skillPath}"`
  let commits: string[]
  try {
    const output = execSync(gitCmd, { cwd, encoding: 'utf-8', stdio: 'pipe' })
    commits = output.trim().split('\n').filter(Boolean)
  } catch {
    return null
  }

  for (const commit of commits) {
    const content = execSync(`git show ${commit}:"${skillPath}"`, { cwd, encoding: 'utf-8', stdio: 'pipe' })
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
    execSync(`git checkout ${commit} -- "${skillPath}"`, { cwd, encoding: 'utf-8', stdio: 'pipe' })
    console.log(`  \u2713 ${member} — restored from ${commit.slice(0, 12)}`)
    return true
  } catch {
    console.error(`  \u2717 ${member} — failed to restore from ${commit.slice(0, 12)}`)
    return false
  }
}

export async function rollback(args: string[]): Promise<void> {
  const cwd = process.cwd()
  const flags = new Set(args.filter((a) => a.startsWith('--')))
  const positionals = args.filter((a) => !a.startsWith('--'))

  const isDryRun = flags.has('--dry-run')
  const targetMember = positionals[0]

  if (targetMember && !/^[a-z0-9][a-z0-9_-]*$/.test(targetMember)) {
    console.error(`Invalid member name: "${targetMember}"`)
    process.exit(1)
    return
  }

  const lockPath = join(cwd, 'agenthood.lock')
  if (!existsSync(lockPath)) {
    console.error('Lockfile not found. Run `agenthood verify --update-lock` first.')
    process.exit(1)
    return
  }

  let lock: Lockfile
  try {
    lock = JSON.parse(readFileSync(lockPath, 'utf8')) as Lockfile
  } catch {
    console.error('Invalid lockfile format.')
    process.exit(1)
    return
  }

  if (targetMember && !lock.members[targetMember]) {
    console.error(`Member "${targetMember}" not found in lockfile.`)
    process.exit(1)
    return
  }

  const membersToRollback = targetMember ? [targetMember] : Object.keys(lock.members)
  let hasRestoredAny = false

  for (const member of membersToRollback) {
    const skillPath = join('members', member, 'SKILL.md')
    const lockedHash = lock.members[member].version

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


