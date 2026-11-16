import type { CommandDescriptor } from './types.ts'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { contentHash } from '../utils/hash.ts'
import { memberSkillPath } from '../members.ts'
import { loadLockTargets } from './lockTargets.ts'
import { updateLockfile } from '../utils/lockfile.ts'
import { resolveSocietyMembersDir } from '../members.ts'
import { SkillParser, parseSkillVersion, SEMVER_RE } from '../skills/discovery/SkillParser.ts'

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

/**
 * Newest commit whose SKILL.md declares this `metadata.version` (#591). Git is the
 * version history: the lockfile records hashes, not past file contents, so the
 * revision list is where a version can actually be restored from.
 */
export function findVersionRevision(cwd: string, skillPath: string, version: string): string | null {
  let commits: string[]
  try {
    const output = execFileSync('git', ['log', '--all', '--pretty=format:%H', '--', skillPath], { cwd, encoding: 'utf-8', stdio: 'pipe' })
    commits = output.trim().split('\n').filter(Boolean)
  } catch {
    return null
  }
  const parser = new SkillParser()
  for (const commit of commits) {
    try {
      const content = execFileSync('git', ['show', `${commit}:${skillPath}`], { cwd, encoding: 'utf-8', stdio: 'pipe' })
      if (parseSkillVersion(parser.parseRaw(content).frontmatter) === version) return commit
    } catch {
      continue
    }
  }
  return null
}

export const command: CommandDescriptor = {
  name: 'rollback',
  description: 'Restore member SKILL.md from the lockfile, or from a version in git history',
  handler: (args) => rollback(args),
}

export async function rollback(args: string[]): Promise<void> {
  const cwd = process.cwd()
  const flags = new Set(args.filter((a) => a.startsWith('--')))
  const positionals = args.filter((a) => !a.startsWith('--'))

  const isDryRun = flags.has('--dry-run')
  const targetMember = positionals[0]

  const versionAt = args.findIndex((a) => a === '--version' || a.startsWith('--version='))
  const version =
    versionAt === -1
      ? undefined
      : (args[versionAt].split('=')[1] ?? args[versionAt + 1])?.trim()

  if (versionAt !== -1) {
    if (!version || !SEMVER_RE.test(version)) {
      console.error(`  ✗ --version needs a semver value, e.g. --version 1.4.0`)
      process.exit(1)
    }
    if (!targetMember) {
      console.error('  ✗ --version needs a member: agenthood rollback <member> --version <semver>')
      process.exit(1)
    }
  }

  const { lock, members: membersToRollback } = loadLockTargets(cwd, targetMember, 'Lockfile not found. Run `agenthood verify --update-lock` first.')
  let hasRestoredAny = false

  for (const member of membersToRollback) {
    // Same canonical member location as `verify` (#740) — forward-slash
    // relative path so `git show <rev>:<path>` accepts the blob syntax.
    const skillPath = memberSkillPath(cwd, member)
    const entry = lock.members[member]
    if (!entry) continue

    // --version goes through git history (#591); the hash path stays the default.
    const commit = version
      ? findVersionRevision(cwd, skillPath, version)
      : findRevision(cwd, skillPath, entry.version)
    if (!commit) {
      console.log(
        version
          ? `  ? ${member} — no revision of ${skillPath} declares version ${version}`
          : `  ? ${member} — no matching revision found in git history`,
      )
      continue
    }

    hasRestoredAny = true
    if (restoreMember(cwd, skillPath, member, commit, isDryRun)) {
      if (!isDryRun) updateLockfile(cwd, resolveSocietyMembersDir(), [member])
    }
  }

  if (!hasRestoredAny) {
    console.error('No members could be restored.')
    process.exit(1)
  }
}


