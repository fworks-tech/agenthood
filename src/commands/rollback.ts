import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

interface Lockfile {
  version: number
  members: Record<string, { version: string; updatedAt: string }>
}

export async function rollback(args: string[]): Promise<void> {
  const cwd = process.cwd()
  const flags = new Set(args.filter((a) => a.startsWith('--')))
  const positionals = args.filter((a) => !a.startsWith('--'))

  const isDryRun = flags.has('--dry-run')
  const targetMember = positionals[0]
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
    return
  }

  if (targetMember && !lock.members[targetMember]) {
    console.error(`Member "${targetMember}" not found in lockfile.`)
    process.exit(1)
    return
  }

  const membersToRollback = targetMember ? [targetMember] : Object.keys(lock.members)

  let foundAny = false

  for (const member of membersToRollback) {
    const skillPath = join('members', member, 'SKILL.md')
    const lockedHash = lock.members[member].version.replace('sha256:', '')

    const gitCmd = `git log --all --pretty=format:"%H" -- "${skillPath}"`
    let commits: string[]
    try {
      const output = execSync(gitCmd, { cwd, encoding: 'utf-8', stdio: 'pipe' })
      commits = output.trim().split('\n').filter(Boolean)
    } catch {
      console.error(`  No git history found for ${member}/SKILL.md`)
      continue
    }

    let restoreCommit: string | null = null
    for (const commit of commits) {
      const content = execSync(`git show ${commit}:"${skillPath}"`, { cwd, encoding: 'utf-8', stdio: 'pipe' })
      const hash = simpleHash(content)
      if (hash === lockedHash) {
        restoreCommit = commit
        break
      }
    }

    if (!restoreCommit) {
      console.log(`  ? ${member} — no matching revision found in git history`)
      continue
    }

    foundAny = true

    if (isDryRun) {
      console.log(`  ~ ${member} — would restore from ${restoreCommit.slice(0, 12)}`)
    } else {
      try {
        execSync(`git checkout ${restoreCommit} -- "${skillPath}"`, { cwd, encoding: 'utf-8', stdio: 'pipe' })
        console.log(`  \u2713 ${member} — restored from ${restoreCommit.slice(0, 12)}`)
      } catch {
        console.error(`  \u2717 ${member} — failed to restore from ${restoreCommit.slice(0, 12)}`)
      }
    }
  }

  if (!foundAny) {
    console.error('No members could be restored.')
    process.exit(1)
  }
}

function simpleHash(content: string): string {
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash).toString(16).padStart(8, '0')
}
