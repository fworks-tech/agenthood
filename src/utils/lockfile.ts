import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { collectResourceHashes } from './skillIntegrity.ts'
import { contentHash } from './hash.ts'
import { SkillParser, parseSkillVersion } from '../skills/discovery/SkillParser.ts'

export interface Lockfile {
  version: number
  members: Record<string, LockfileMember>
}

// resources maps member-relative paths (scripts/run.mjs) to SHA-256 hex.
// Absent on pre-#604 locks — readers treat missing as "not yet locked".
export interface LockfileMember {
  version: string
  updatedAt: string
  resources?: Record<string, string>
  /** `metadata.version` from the locked SKILL.md — the skill's own semver, not the hash above. */
  skillVersion?: string
}

export function loadLockfile(cwd: string): Lockfile | undefined {
  const lockPath = join(cwd, 'agenthood.lock')
  if (!existsSync(lockPath)) return undefined
  try {
    return JSON.parse(readFileSync(lockPath, 'utf8')) as Lockfile
  } catch {
    return undefined
  }
}

/**
 * Re-lock the given members (hash + resolved version + resource hashes).
 *
 * Merges into the existing lock rather than rebuilding from the scanned subset,
 * so `verify <member> --update-lock` cannot drop every other member. Keeps each
 * unchanged member's `updatedAt`, so a one-skill edit is a one-line diff, and
 * writes sorted keys so a regen on any platform is byte-identical.
 */
export function updateLockfile(cwd: string, membersDir: string, members: string[]): void {
  const lockPath = join(cwd, 'agenthood.lock')
  const existing = loadLockfile(cwd)
  const next: Record<string, LockfileMember> = { ...(existing?.members ?? {}) }
  const now = new Date().toISOString()
  let changed = 0
  const parser = new SkillParser()
  for (const member of members) {
    const skillPath = join(membersDir, member, 'SKILL.md')
    if (!existsSync(skillPath)) continue
    const content = readFileSync(skillPath, 'utf8')
    const hash = contentHash(content)
    const resources = collectResourceHashes(join(membersDir, member))
    const skillVersion = parseSkillVersion(parser.parseRaw(content).frontmatter)
    const prev = next[member]
    const resourcesChanged = JSON.stringify(prev?.resources ?? {}) !== JSON.stringify(resources)
    next[member] = {
      version: hash,
      updatedAt: prev && prev.version === hash && !resourcesChanged ? prev.updatedAt : now,
      ...(Object.keys(resources).length > 0 ? { resources } : {}),
      ...(skillVersion ? { skillVersion } : {}),
    }
    if (!prev || prev.version !== hash || resourcesChanged) changed++
  }
  const lock = { version: 1, members: Object.fromEntries(Object.keys(next).sort().map((k) => [k, next[k]])) }
  writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n', 'utf8')
  console.log(`\n  Lockfile updated (${changed} member(s) re-locked) → ${lockPath}`)
}
