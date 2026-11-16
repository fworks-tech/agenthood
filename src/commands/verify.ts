import { existsSync, readFileSync, readdirSync } from 'node:fs'
import type { CommandDescriptor } from './types.ts'
import { MEMBER_NAME_RE, MEMBER_NAMES, memberResourcePath, memberSkillPath, resolveSocietyMembersDir } from '../members.ts'
import { join } from 'node:path'
import { contentHash } from '../utils/hash.ts'
import { loadLockfile, updateLockfile } from '../utils/lockfile.ts'
import type { Lockfile } from '../utils/lockfile.ts'
import { checkResourceIntegrity, checkSkillIntegrity } from '../utils/skillIntegrity.ts'
import { findResourceRevision, findRevision, restoreMember } from './rollback.ts'
import {
  SkillParser,
  parseAllowedTools,
  parseCompatibility,
  parseOwner,
  parseSkillVersion,
  isSpdxLicense,
  MAX_COMPATIBILITY_LENGTH,
  SEMVER_RE,
} from '../skills/discovery/SkillParser.ts'
import { OWNER_RE } from '../skills/namespace.ts'
import { isKnownToolName } from '../members/toolVocabulary.ts'
import { scanForInjections } from '../skills/discovery/injectionScan.ts'
import { userError } from '../core/cliError.ts'
import type { SkillTier } from '../skills/discovery/ISkillManifest.ts'
import { SkillDiscovery } from '../skills/discovery/SkillDiscovery.ts'
import { findConflicts } from '../skills/conflicts.ts'
import type { ConflictCandidate } from '../skills/conflicts.ts'
import { findLaneOverlaps } from '../members/laneOverlap.ts'
import { rawSpecs } from '../members/member-specs.ts'
import { auditRoutingRecords, PARALLEL_EVALUATION_THRESHOLD, ROUTING_INTENTS } from '../reasoning/routing.ts'

const REQUIRED_SECTIONS = ['Overview', 'When to Use', 'Process', 'Red Flags', 'Rationalizations', 'Verification']

const TIER_REQUIRED_SECTIONS: Record<SkillTier, string[]> = {
  official: REQUIRED_SECTIONS,
  community: REQUIRED_SECTIONS,
  experimental: ['Overview', 'When to Use'],
}

// Marker form only: a real placeholder is the tag followed by a structural
// character (":", "(", "-"). Mentions in prose ("TODO and FIXME comments",
// "Find TODO") are followed by a space + word and must not count.
const PLACEHOLDER_PATTERNS = [/\bTBD\s*[-:(]/i, /\bTODO\s*[-:(]/i, /\bFIXME\s*[-:(]/i]

interface VerifyResult {
  member: string
  pass: boolean
  drift: boolean
  issues: string[]
}

function validateMember(membersDir: string, member: string, lockfile?: Lockfile, strict = false): VerifyResult {
  const result: VerifyResult = { member, pass: true, drift: false, issues: [] }
  const skillPath = join(membersDir, member, 'SKILL.md')

  if (!existsSync(skillPath)) {
    result.pass = false
    result.issues.push('SKILL.md not found')
    return result
  }

  const content = readFileSync(skillPath, 'utf8')
  const parser = new SkillParser()
  const { frontmatter, body, heuristic } = parser.parseRaw(content)
  const tier = parser.parseTier(frontmatter)

  if (heuristic) result.issues.push('Frontmatter needed heuristic parsing — quote values containing colons')

  if (!frontmatter) {
    result.issues.push('Missing YAML frontmatter')
  } else {
    if (!frontmatter.name) result.issues.push('Frontmatter missing "name"')
    if (!frontmatter.description) result.issues.push('Frontmatter missing "description"')
    if (!frontmatter.license) {
      result.issues.push('Frontmatter missing "license". Fix: add license: MIT (or UNLICENSED)')
    } else if (!isSpdxLicense(String(frontmatter.license))) {
      result.issues.push(`license "${String(frontmatter.license)}" is not an SPDX identifier. Fix: use the SPDX id, e.g. MIT, Apache-2.0, or UNLICENSED`)
    }
    const compatibility = parseCompatibility(frontmatter)
    if (compatibility && compatibility.length > MAX_COMPATIBILITY_LENGTH) {
      result.issues.push(`compatibility is ${compatibility.length} chars, over the ${MAX_COMPATIBILITY_LENGTH}-char spec limit. Fix: state the environment requirement in one short sentence`)
    }
    // Namespace (#593): optional locally, but a malformed owner would make the
    // skill unpublishable later, so reject it at author time.
    const owner = parseOwner(frontmatter)
    if (owner && !OWNER_RE.test(owner)) {
      result.issues.push(`metadata.author "${owner}" is not a valid namespace. Fix: lowercase letters, digits and single hyphens, e.g. fworks-tech`)
    }
    const version = parseSkillVersion(frontmatter)
    if (!version) {
      result.issues.push('Frontmatter missing "metadata.version". Fix: add metadata:\\n  version: 1.0.0')
    } else if (!SEMVER_RE.test(version)) {
      result.issues.push(`metadata.version "${version}" is not semver. Fix: use major.minor.patch, e.g. 1.4.0`)
    }
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
    // Runtime ignores unknown names so skills from other clients still load; an
    // author-time typo should not pass silently (#561).
    const declared = parseAllowedTools(frontmatter['allowed-tools'] ?? frontmatter.allowed_tools) ?? []
    for (const tool of declared.filter((t) => !isKnownToolName(t))) {
      result.issues.push(`allowed-tools names "${tool}", which matches no tool. Fix: use a skill vocabulary name such as file.read or code.write`)
    }
  }

  const requiredSections = TIER_REQUIRED_SECTIONS[tier]
  for (const section of requiredSections) {
    const sectionRegex = new RegExp(`## ${section}`, 'i')
    if (!sectionRegex.test(body)) {
      result.issues.push(`Missing required section: "${section}"`)
    }
  }

  // Strip fenced/inline code — examples of what a skill detects
  // (e.g. `// TODO: fix this`) are not unfinished skill content.
  const proseBody = body.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '')
  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(proseBody)) {
      result.issues.push(`Contains placeholder content matching "${pattern.source}"`)
    }
  }

  if (lockfile && lockfile.members[member]) {
    const currentHash = contentHash(content)
    const lockedHash = lockfile.members[member].version
    if (currentHash !== lockedHash) result.drift = true
  }

  // Resource surface (scripts/, references/) hashed alongside SKILL.md (#604).
  // Skipped until the member has a lock entry — lock creation itself
  // (updateLockfile) is what first records the resource hashes.
  const lockedResources = lockfile?.members[member]?.resources
  if (lockfile?.members[member]) {
    for (const issue of checkResourceIntegrity(join(membersDir, member), lockedResources)) {
      result.issues.push(issue)
    }
  }

  // Prompt-injection screen (#606): warn by default so local flows keep
  // working; --strict fails the run on known-malicious patterns.
  for (const finding of scanForInjections(content)) {
    if (strict && finding.severity === 'block') {
      result.issues.push(`Injection (${finding.pattern}): "${finding.excerpt}"`)
    } else {
      console.warn(`  ⚠ ${member} — possible injection (${finding.pattern}): "${finding.excerpt}"`)
    }
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
    userError('Lockfile drift detected', { fix: 'Run `agenthood verify --update-lock` and commit agenthood.lock.' })
    return
  }
  console.log(`\n  ✓ Lockfile integrity OK — ${members.length} member(s) match agenthood.lock`)
}

function reportIntegrity(cwd: string, membersDir: string, members: string[], lockfile?: Lockfile): void {
  let failed = 0
  for (const member of members) {
    const status = checkSkillIntegrity(member, join(membersDir, member, 'SKILL.md'), { lockfilePath: cwd })
    const resourceIssues = lockfile?.members[member]
      ? checkResourceIntegrity(join(membersDir, member), lockfile.members[member].resources)
      : []
    if (status === 'clean' && resourceIssues.length === 0) {
      console.log(`  ✓ ${member} — clean`)
    } else {
      failed++
      console.log(`  ✗ ${member} — ${status}`)
      for (const issue of resourceIssues) console.log(`      - ${issue}`)
    }
  }
  if (failed > 0) {
    userError(`Integrity check failed for ${failed} member(s)`, { fix: 'Run `agenthood verify --fix` to restore from git, or `verify --update-lock` if the edit is intentional.' })
    return
  }
  console.log(`\n  ✓ Integrity OK — ${members.length} member(s) match agenthood.lock`)
}

function fixDrift(cwd: string, membersDir: string, members: string[], lockfile?: Lockfile): void {
  if (!lockfile) {
    userError('No lockfile found', { fix: 'Run `agenthood verify --update-lock` to create one.' })
    return
  }
  let restored = 0
  let unrestorable = 0
  for (const member of members) {
    const status = checkSkillIntegrity(member, join(membersDir, member, 'SKILL.md'), { lockfilePath: cwd })
    if (status !== 'clean') {
      const skillPath = memberSkillPath(cwd, member)
      const commit = findRevision(cwd, skillPath, lockfile.members[member]?.version ?? '')
      if (!commit) {
        console.log(`  ? ${member} — no matching revision in git history (re-lock if intentional)`)
        unrestorable++
      } else if (restoreMember(cwd, skillPath, member, commit, false)) restored++
      else unrestorable++
    }

    // Resource surface (#604): restoring SKILL.md alone would leave a tampered
    // script in place while reporting the member as fixed.
    const lockedResources = lockfile.members[member]?.resources
    if (!lockedResources) continue
    for (const issue of checkResourceIntegrity(join(membersDir, member), lockedResources)) {
      const rel = issue.replace(/^(untracked resource|resource drift|resource missing): /, '')
      if (issue.startsWith('untracked resource')) {
        // not in the lock — nothing to restore to; it needs a re-lock or removal
        console.log(`  ? ${member} — untracked resource ${rel} (re-lock to adopt, or delete it)`)
        continue
      }
      const relPath = memberResourcePath(cwd, member, rel)
      const resourceCommit = findResourceRevision(cwd, relPath, lockedResources[rel])
      if (!resourceCommit) {
        console.log(`  ? ${member}/${rel} — no matching revision in git history (re-lock if intentional)`)
        unrestorable++
      } else if (restoreMember(cwd, relPath, `${member}/${rel}`, resourceCommit, false)) restored++
      else unrestorable++
    }
  }
  console.log(`\n  Restored ${restored} file(s)${unrestorable > 0 ? `, ${unrestorable} need manual attention` : ''}.`)
  if (unrestorable > 0) {
    userError('Some members could not be restored', { fix: 'Run `agenthood verify --update-lock` if the edits are intentional.' })
  }
}

function reportLaneOverlaps(): void {
  const overlaps = findLaneOverlaps(rawSpecs)
  if (overlaps.length > 0) {
    console.log('\n  Strict mode: lane overlap detected:')
    for (const o of overlaps) {
      console.log(`    \u26a0 ${o.a} \u2194 ${o.b} (shared: ${o.shared.join(', ')})`)
    }
    userError('Lane overlap detected', { fix: 'Remove duplicate responsibilities from member SKILL.md files.' })
  }
  console.log('\n  Strict mode: lane overlap check passed.')
}

// The Mediator and The Steward are prompt-driven — no runtime class writes a
// routing record, so members hand-write them and this is the only place the
// documented schema is enforced. Absent directory is a pass, not a skip: a
// Society that has not routed anything is in the correct state, and CI has no
// .agenthood at all.
function reportRoutingRecords(cwd: string): void {
  const failures = auditRoutingRecords(join(cwd, '.agenthood', 'routing'), MEMBER_NAMES)
  if (failures.length === 0) {
    console.log('\n  ✓ Routing records: schema OK.')
    return
  }
  console.log(`\n  Routing records: ${failures.length} of the record(s) in .agenthood/routing violate the schema:`)
  for (const f of failures) {
    console.log(`    \u26a0 ${f.file}`)
    for (const e of f.errors) console.log(`        ${e}`)
  }
  userError('Routing record validation failed', {
    fix: `intent must be one of ${ROUTING_INTENTS.join('/')}, confidence an integer 0-100, target a registered member, and a score below ${PARALLEL_EVALUATION_THRESHOLD} requires cascade_applied: true plus a parallel_evaluation.`,
  })
}

function collectConflictCandidates(membersDir: string, discovered: ConflictCandidate[]): ConflictCandidate[] {
  const parser = new SkillParser()
  const byName = new Map<string, ConflictCandidate>()
  // Members first — they are the canonical skill surface, and a discovered
  // copy under the same name is the same slot, not a second skill.
  for (const member of MEMBER_NAMES) {
    const skillPath = join(membersDir, member, 'SKILL.md')
    if (!existsSync(skillPath)) continue
    const { frontmatter } = parser.parseRaw(readFileSync(skillPath, 'utf8'))
    const name = typeof frontmatter?.name === 'string' ? frontmatter.name : member
    const description = typeof frontmatter?.description === 'string' ? frontmatter.description : ''
    if (!byName.has(name)) byName.set(name, { name, description })
  }
  for (const s of discovered) {
    if (!byName.has(s.name)) byName.set(s.name, s)
  }
  return [...byName.values()]
}

function reportConflicts(membersDir: string): void {
  const discovered = new SkillDiscovery().discover(process.cwd())
  const candidates = collectConflictCandidates(membersDir, discovered)
  const conflicts = findConflicts(candidates)
  if (conflicts.length === 0) {
    console.log(`\n  ✓ Conflict scan: no description overlaps above threshold across ${candidates.length} skill(s).`)
    return
  }
  console.log(`\n  Conflict scan: ${conflicts.length} overlapping description pair(s) across ${candidates.length} skill(s):`)
  for (const c of conflicts) {
    console.log(`    \u26a0 ${c.a} \u2194 ${c.b} (overlap ${Math.round(c.score * 100)}%)`)
    console.log(`      shared terms: ${c.shared.join(', ')}`)
    console.log(`      resolution: ${c.resolution}`)
  }
  console.log('    Resolve manually: edit the descriptions, remove one skill, or narrow its "Use when" triggers.')
}

/**
 * Two skills declaring the same `owner/name` cannot both be published, and the
 * local copy-paste that produces them is the conflict #593 exists to prevent.
 * Scans every skill directory, not only members — the collision usually involves
 * a non-member pack from another author.
 */
function findNamespaceConflicts(membersDir: string): string[] {
  const parser = new SkillParser()
  const byRef = new Map<string, string>()
  let entries: string[]
  try {
    entries = readdirSync(membersDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  } catch {
    return []
  }

  for (const dir of entries) {
    const skillPath = join(membersDir, dir, 'SKILL.md')
    if (!existsSync(skillPath)) continue
    const { frontmatter } = parser.parseRaw(readFileSync(skillPath, 'utf8'))
    const owner = parseOwner(frontmatter)
    if (!owner) continue
    const name = typeof frontmatter?.name === 'string' ? frontmatter.name : dir
    const ref = `${owner}/${name}`
    const previous = byRef.get(ref)
    if (previous) return [`Duplicate namespace "${ref}" in "${previous}" and "${dir}". Fix: give each skill a distinct metadata.author or name`]
    byRef.set(ref, dir)
  }
  return []
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
  const conflicts = flags.has('--conflicts')
  const targetMember = positionals[0]

  if (targetMember && !MEMBER_NAME_RE.test(targetMember)) {
    userError(`Invalid member name: "${targetMember}"`, { fix: 'Member names must match the pattern: lowercase letters, numbers, and hyphens.' })
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

  // --integrity (#604): per-member tamper report over SKILL.md + resources.
  // No structural checks — fails only when a hash does not match the lock.
  if (flags.has('--integrity')) {
    reportIntegrity(cwd, membersDir, membersToCheck, lockfile)
    return
  }

  // --fix (#604): restore drifted SKILL.md files from git history (same
  // revision-matching as `rollback`), then report what still needs a re-lock.
  if (flags.has('--fix')) {
    fixDrift(cwd, membersDir, membersToCheck, lockfile)
    return
  }

  const results = membersToCheck.map((m) => validateMember(membersDir, m, lockfile, isStrict))
  printResults(results)

  const namespaceConflicts = findNamespaceConflicts(membersDir)
  for (const conflict of namespaceConflicts) console.log(`  \u2717 ${conflict}`)

  const structuralOk = results.every((r) => r.pass) && namespaceConflicts.length === 0
  const hasDrift = results.some((r) => r.drift)

  if (isStrict) reportLaneOverlaps()

  reportRoutingRecords(cwd)

  // Advisory (#595): overlapping descriptions mean two skills can both trigger
  // for the same task. Warns only — the resolution (dedup vs specialize) is a
  // judgment call, so unlike --strict lane overlap it never fails the run.
  if (conflicts) reportConflicts(membersDir)

  // --update-lock is the accept path for intentional edits, so it must work
  // *despite* drift (re-locking changed members is its whole purpose) — only a
  // structural failure blocks the write. Plain `verify` never writes and fails
  // on drift, preserving the integrity gate that CI (--strict) and ADR-020 rely on.
  if (updateLock && structuralOk) {
    updateLockfile(cwd, membersDir, membersToCheck)
  }

  if (!structuralOk || (!updateLock && hasDrift)) {
    userError('Verify failed', { fix: 'Run `agenthood verify --update-lock` to re-lock, or fix structural issues.' })
  }
}


