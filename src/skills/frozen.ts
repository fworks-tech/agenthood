/**
 * `--frozen` lockfile gate (#589).
 *
 * CI needs to know the skills on disk are the ones the lockfile says they are.
 * `verify --lock-only` covers Society members; this covers third-party skills
 * installed into the project, which is what a consumer's pipeline actually
 * depends on.
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { contentHash } from '../utils/hash.ts'
import { resolveSkillsDir, SKILLS_LOCKFILE } from '../members.ts'

export interface FrozenReport {
  ok: boolean
  problems: string[]
}

function loadLock(projectPath: string): { lock?: { skills?: Record<string, { source: string; version?: string }> }; problems: string[] } {
  const lockPath = join(resolveSkillsDir(projectPath), SKILLS_LOCKFILE)
  try {
    if (!existsSync(lockPath)) {
      return { problems: [`${SKILLS_LOCKFILE} not found — run \`agenthood install\` without --frozen to create it`] }
    }
    return { lock: JSON.parse(readFileSync(lockPath, 'utf-8')) as { skills?: Record<string, { source: string; version?: string }> }, problems: [] }
  } catch (err) {
    return { problems: [`${SKILLS_LOCKFILE} is unreadable: ${(err as Error)?.message ?? err}`] }
  }
}

/**
 * CI gate for one `agenthood install --frozen <source>`.
 *
 * It is intentionally narrower than `checkFrozen`: --frozen installs from a
 * lockfile, and a fresh checkout has no installed skills yet, so "locked entry
 * missing on disk" is the expected pre-install state, not drift. What --frozen
 * must catch is a lockfile that cannot describe the skill being requested or a
 * local file that no longer matches the lock.
 */
export function assertFrozenInstall(projectPath: string, source: string, name: string, fetchedHash: string): FrozenReport {
  const { lock, problems } = loadLock(projectPath)
  if (!lock) return { ok: false, problems }

  const locked = lock.skills ?? {}
  const entry = locked[name]
  if (!entry) {
    return { ok: false, problems: [`"${name}" is not in ${SKILLS_LOCKFILE} — --frozen will not add an unlocked skill`] }
  }
  if (entry.source !== source) {
    // A different URL for the same skill name is a different artifact.
    problems.push(`"${name}" is locked from "${entry.source}", not "${source}"`)
  }
  if (entry.version && entry.version !== fetchedHash) {
    problems.push(`"${name}" fetched hash does not match the locked hash in ${SKILLS_LOCKFILE}`)
  }
  if (!entry.version) {
    problems.push(`"${name}" has no locked checksum in ${SKILLS_LOCKFILE} — run \`agenthood install\` once without --frozen to pin it`)
  }

  for (const [otherName, other] of Object.entries(locked)) {
    const skillMd = join(resolveSkillsDir(projectPath), otherName, 'SKILL.md')
    if (!existsSync(skillMd)) continue
    if (!other.version) continue
    if (contentHash(readFileSync(skillMd, 'utf-8')) !== other.version) {
      problems.push(`"${otherName}" drifted from its locked hash in ${SKILLS_LOCKFILE}`)
    }
  }

  return { ok: problems.length === 0, problems }
}

/**
 * Compare installed skills against skills-lock.json.
 *
 * `requestedNames` is the set of skills the caller is about to install or
 * verify. A name in it that the lockfile has never seen is a problem — installing
 * it would change the lock — while a name absent from it is not this gate's
 * business, so members and pre-existing skills do not block a run.
 */
export function checkFrozen(projectPath: string, requestedNames: string[]): FrozenReport {
  const skillsDir = resolveSkillsDir(projectPath)
  const lockPath = join(skillsDir, SKILLS_LOCKFILE)
  const problems: string[] = []

  let lock: { skills?: Record<string, { source: string; version?: string }> }
  try {
    if (!existsSync(lockPath)) {
      return { ok: false, problems: [`${SKILLS_LOCKFILE} not found — run \`agenthood install\` without --frozen to create it`] }
    }
    lock = JSON.parse(readFileSync(lockPath, 'utf-8')) as typeof lock
  } catch (err) {
    return { ok: false, problems: [`${SKILLS_LOCKFILE} is unreadable: ${(err as Error)?.message ?? err}`] }
  }

  const locked = lock.skills ?? {}

  for (const name of requestedNames) {
    if (!(name in locked)) {
      problems.push(`"${name}" is not in ${SKILLS_LOCKFILE} — --frozen refuses to install an unlocked skill`)
    }
  }

  for (const [name, entry] of Object.entries(locked)) {
    const skillMd = join(skillsDir, name, 'SKILL.md')
    if (!existsSync(skillMd)) {
      problems.push(`"${name}" is locked but ${join(skillsDir, name, 'SKILL.md')} is missing`)
      continue
    }
    // A pre-#604 lock carries no version. Absence of a hash is not evidence of
    // drift, so presence is all we can check — refusing would break every
    // install made before checksums existed.
    if (!entry.version) continue
    if (contentHash(readFileSync(skillMd, 'utf-8')) !== entry.version) {
      problems.push(`"${name}" drifted from its locked hash in ${SKILLS_LOCKFILE}`)
    }
  }

  return { ok: problems.length === 0, problems }
}

export function reportFrozenFailure(report: FrozenReport): never {
  console.error('\n  ✗ --frozen: the lockfile does not describe the skills on disk')
  for (const problem of report.problems) console.error(`      - ${problem}`)
  console.error('\n    Resolve with `agenthood install <source>` (updates the lockfile),')
  console.error('    or drop --frozen to install and lock in one step.\n')
  process.exit(1)
}
