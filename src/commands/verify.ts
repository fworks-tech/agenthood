import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import type { CommandDescriptor } from './types.ts'
import { MEMBER_NAME_RE, MEMBER_NAMES, resolveSocietyMembersDir } from '../members.ts'
import { join } from 'node:path'
import { contentHash } from '../utils/hash.ts'
import { loadLockfile } from '../utils/lockfile.ts'
import type { Lockfile } from '../utils/lockfile.ts'
import { SkillParser } from '../skills/discovery/SkillParser.ts'
import type { SkillTier } from '../skills/discovery/ISkillManifest.ts'
import { findLaneOverlaps } from '../members/laneOverlap.ts'
import { rawSpecs } from '../members/member-specs.ts'

const REQUIRED_SECTIONS = ['Overview', 'When to Use', 'Process', 'Red Flags', 'Rationalizations', 'Verification']

const TIER_REQUIRED_SECTIONS: Record<SkillTier, string[]> = {
  official: REQUIRED_SECTIONS,
  community: REQUIRED_SECTIONS,
  experimental: ['Overview', 'When to Use'],
}

const PLACEHOLDER_PATTERNS = [/TBD/i, /TODO/i, /FIXME/i]

interface VerifyResult {
  member: string
  pass: boolean
  drift: boolean
  issues: string[]
}

function validateMember(membersDir: string, member: string, lockfile?: Lockfile): VerifyResult {
  const result: VerifyResult = { member, pass: true, drift: false, issues: [] }
  const skillPath = join(membersDir, member, 'SKILL.md')

  if (!existsSync(skillPath)) {
    result.pass = false
    result.issues.push('SKILL.md not found')
    return result
  }

  const content = readFileSync(skillPath, 'utf8')
  const parser = new SkillParser()
  const { frontmatter, body } = parser.parseRaw(content)
  const tier = parser.parseTier(frontmatter)

  if (!frontmatter) {
    result.issues.push('Missing YAML frontmatter')
  } else {
    if (!frontmatter.name) result.issues.push('Frontmatter missing "name"')
    if (!frontmatter.description) result.issues.push('Frontmatter missing "description"')
    if (!frontmatter.license) result.issues.push('Frontmatter missing "license"')
    if (tier === 'official' && frontmatter.tier !== 'official') {
      result.issues.push('Official skills must declare "tier: official" in frontmatter')
    }
    // agentskills.io spec conformance — non-conforming skills load in agenthood
    // but fail silently in other runtimes, breaking cross-client portability.
    const name = typeof frontmatter.name === 'string' ? frontmatter.name : ''
    const description = typeof frontmatter.description === 'string' ? frontmatter.description : ''
    for (const e of parser.validateSpec(name, description, member)) {
      result.issues.push(`Spec (${e.rule}): ${e.message}. Fix: ${e.fix}`)
    }
  }

  const requiredSections = TIER_REQUIRED_SECTIONS[tier]
  for (const section of requiredSections) {
    const sectionRegex = new RegExp(`## ${section}`, 'i')
    if (!sectionRegex.test(body)) {
      result.issues.push(`Missing required section: "${section}"`)
    }
  }

  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(body)) {
      result.issues.push(`Contains placeholder content matching "${pattern.source}"`)
    }
  }

  if (lockfile && lockfile.members[member]) {
    const currentHash = contentHash(content)
    const lockedHash = lockfile.members[member].version
    if (currentHash !== lockedHash) result.drift = true
  }

  if (result.issues.length > 0) result.pass = false
  return result
}

function memberDrift(membersDir: string, member: string, lockfile?: Lockfile): boolean {
  if (!lockfile?.members[member]) return false
  const skillPath = join(membersDir, member, 'SKILL.md')
  if (!existsSync(skillPath)) return false
  return contentHash(readFileSync(skillPath, 'utf8')) !== lockfile.members[member].version
}

function lockIntegrityGate(membersDir: string, members: string[], lockfile?: Lockfile): void {
  const drifted = members.filter((m) => memberDrift(membersDir, m, lockfile))
  if (drifted.length > 0) {
    console.log(`\n  ✗ Lockfile drift — ${drifted.length} member(s) changed without a re-lock: ${drifted.join(', ')}`)
    console.log('    Run `agenthood verify --update-lock` and commit agenthood.lock.\n')
    process.exit(1)
    return
  }
  console.log(`\n  ✓ Lockfile integrity OK — ${members.length} member(s) match agenthood.lock`)
}

function reportLaneOverlaps(): void {
  const overlaps = findLaneOverlaps(rawSpecs)
  if (overlaps.length > 0) {
    console.log('\n  Strict mode: lane overlap detected:')
    for (const o of overlaps) {
      console.log(`    \u26a0 ${o.a} \u2194 ${o.b} (shared: ${o.shared.join(', ')})`)
    }
    process.exit(1)
  }
  console.log('\n  Strict mode: lane overlap check passed.')
}

function printResults(results: VerifyResult[]): void {
  for (const r of results) {
    if (r.pass && !r.drift) {
      console.log(`  \u2713 ${r.member}`)
    } else {
      console.log(`  \u2717 ${r.member}`)
      for (const issue of r.issues) {
        console.log(`      - ${issue}`)
      }
      if (r.drift) {
        console.log(`      - Drift detected — SKILL.md hash does not match lockfile. Run \`verify --update-lock\` to re-lock.`)
      }
    }
  }
}

function updateLockfile(cwd: string, membersDir: string, members: string[]): void {
  const lockPath = join(cwd, 'agenthood.lock')
  const existing = loadLockfile(cwd)
  // Merge into the existing lock rather than rebuilding from the scanned
  // subset, so `verify <member> --update-lock` cannot drop every other member.
  const next: Record<string, { version: string; updatedAt: string }> = { ...(existing?.members ?? {}) }
  const now = new Date().toISOString()
  let changed = 0
  for (const member of members) {
    const skillPath = join(membersDir, member, 'SKILL.md')
    if (existsSync(skillPath)) {
      const content = readFileSync(skillPath, 'utf8')
      const hash = contentHash(content)
      const prev = next[member]
      // Preserve updatedAt when the hash is unchanged — otherwise regenerating
      // the lock for one edited skill rewrites all 20 timestamps and produces
      // a merge conflict on every concurrent branch.
      next[member] = { version: hash, updatedAt: prev && prev.version === hash ? prev.updatedAt : now }
      if (!prev || prev.version !== hash) changed++
    }
  }
  // Deterministic key order so a regen on any platform (or any FS iteration
  // order) yields byte-identical output and a minimal diff.
  const lock = { version: 1, members: Object.fromEntries(Object.keys(next).sort().map((k) => [k, next[k]])) }
  writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n', 'utf8')
  console.log(`\n  Lockfile updated (${changed} member(s) re-locked) → ${lockPath}`)
}

export const command: CommandDescriptor = {
  name: 'verify',
  description: 'Validate member SKILL.md integrity, spec conformance, and lockfile',
  handler: (args) => verify(args),
}

export async function verify(args: string[]): Promise<void> {
  const cwd = process.cwd()
  const membersDir = resolveSocietyMembersDir()
  const flags = new Set(args.filter((a) => a.startsWith('--')))
  const positionals = args.filter((a) => !a.startsWith('--'))

  const isStrict = flags.has('--strict')
  const updateLock = flags.has('--update-lock')
  const lockOnly = flags.has('--lock-only')
  const targetMember = positionals[0]

  if (targetMember && !MEMBER_NAME_RE.test(targetMember)) {
    console.error(`Invalid member name: "${targetMember}"`)
    process.exit(1)
    return
  }

  const lockfile = loadLockfile(cwd)
  if (!lockfile) {
    console.log('\n  No lockfile found — drift detection unavailable. Run `verify --update-lock` to create one.\n')
  }

  // Only validate the members the Society actually ships — the lockfile's set
  // (or the registry when bootstrapping), never every subdir of skills/, which
  // also holds ~40 non-member skill packs (#740). Lock keys are attacker-
  // influenced, so re-validate each before it becomes a filesystem path.
  const memberSet = lockfile ? Object.keys(lockfile.members) : [...MEMBER_NAMES]
  const membersToCheck = targetMember
    ? [targetMember]
    : memberSet.filter((m) => MEMBER_NAME_RE.test(m))

  // Integrity-only mode (CI gate, #740): a pure lock-vs-hash diff. Deliberately
  // ignores structural/prose checks (sections, placeholders, spec) so the gate
  // fails only when a SKILL.md changed without a matching re-lock.
  if (lockOnly) {
    lockIntegrityGate(membersDir, membersToCheck, lockfile)
    return
  }

  const results = membersToCheck.map((m) => validateMember(membersDir, m, lockfile))
  printResults(results)

  const structuralOk = results.every((r) => r.pass)
  const hasDrift = results.some((r) => r.drift)

  if (isStrict) reportLaneOverlaps()

  // --update-lock is the accept path for intentional edits, so it must work
  // *despite* drift (re-locking changed members is its whole purpose) — only a
  // structural failure blocks the write. Plain `verify` never writes and fails
  // on drift, preserving the integrity gate that CI (--strict) and ADR-020 rely on.
  if (updateLock && structuralOk) {
    updateLockfile(cwd, membersDir, membersToCheck)
  }

  if (!structuralOk || (!updateLock && hasDrift)) {
    process.exit(1)
  }
}


