import { readFileSync, existsSync, readdirSync, type Dirent } from 'node:fs'
import { join, dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { ExecutionContext } from '../core/ExecutionContext.ts'
import { contentHash, fileHash } from './hash.ts'

export type SkillIntegrityStatus = 'clean' | 'drift' | 'corrupt' | 'no-lockfile' | 'missing'
/** Reasons that surface the integrity gate as inactive or violated — everything except 'clean'. */
export type SkillIntegrityFailure = 'drift' | 'corrupt' | 'no-lockfile' | 'missing'

export interface SkillIntegrityOptions {
  lockfilePath?: string
}

/**
 * Injection-time persistence-vector check (ADR-020, extended by #604): the member
 * SKILL.md is injected into the system prompt like the paper's SOUL.md, so hash it
 * against agenthood.lock at prompt-assembly time. Drift means the injected file may
 * have been tampered with (a mind-virus persistence vector); a corrupt lockfile is
 * treated as suspicious rather than silently skipped, since tampering may also leave
 * the lock unreadable. When the lock entry carries `resources`, the member's
 * scripts/ and references/ are checked too — those are the files that execute.
 * Pure — never throws; callers decide whether drift/corruption is a hard block.
 */
export function checkSkillIntegrity(
  member: string,
  skillPath: string,
  options: SkillIntegrityOptions = {},
): SkillIntegrityStatus {
  const lockPath = join(options.lockfilePath ?? process.cwd(), 'agenthood.lock')
  if (!existsSync(lockPath)) return 'no-lockfile'
  let raw: string
  try {
    raw = readFileSync(lockPath, 'utf-8')
  } catch {
    return 'corrupt'
  }
  let lockfile: { members?: Record<string, { version: string; resources?: Record<string, string> }> }
  try {
    lockfile = JSON.parse(raw) as { members?: Record<string, { version: string; resources?: Record<string, string> }> }
  } catch {
    return 'corrupt'
  }
  const entry = lockfile.members?.[member]
  if (!entry) return 'no-lockfile'
  if (!existsSync(skillPath)) return 'missing'
  const current = contentHash(readFileSync(skillPath, 'utf-8'))
  if (current !== entry.version) return 'drift'
  // SKILL.md matches — now the resource surface, when the lock recorded one.
  if (entry.resources && checkResourceIntegrity(dirname(skillPath), entry.resources).length > 0) return 'drift'
  return 'clean'
}

// Resource dirs hashed alongside SKILL.md (#604) — mirrors the manifest
// surface (SkillParser.parseManifest collects scripts/ + references/).
const RESOURCE_DIRS = ['scripts', 'references']

// Map member-relative resource paths to SHA-256 hex. One level deep, files
// only — same surface parseManifest advertises, so the lock cannot drift from
// the manifest on nesting.
export function collectResourceHashes(memberDir: string): Record<string, string> {
  const hashes: Record<string, string> = {}
  for (const sub of RESOURCE_DIRS) {
    let entries: Dirent[]
    try {
      entries = readdirSync(join(memberDir, sub), { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      try {
        if (!entry.isFile()) continue
        hashes[`${sub}/${entry.name}`] = fileHash(join(memberDir, sub, entry.name))
      } catch {
        continue
      }
    }
  }
  return hashes
}

// Drifted, missing, and untracked resource paths vs the lockfile. Empty means
// the resource surface matches — the --integrity report and validateMember
// compose from this so the vocabulary stays in one place.
export function checkResourceIntegrity(memberDir: string, locked?: Record<string, string>): string[] {
  const current = collectResourceHashes(memberDir)
  const issues: string[] = []
  for (const [rel, hash] of Object.entries(current)) {
    if (!locked || !(rel in locked)) {
      issues.push(`untracked resource: ${rel}`)
    } else if (locked[rel] !== hash) {
      issues.push(`resource drift: ${rel}`)
    }
  }
  if (locked) {
    for (const rel of Object.keys(locked)) {
      if (!(rel in current)) issues.push(`resource missing: ${rel}`)
    }
  }
  return issues
}

/**
 * Single source for mapping an integrity failure reason to its canonical
 * human phrase. Every consumer (SkillIntegrityError, the durable record, and
 * the console warning) composes from this so the operator-facing vocabulary
 * cannot drift between spellings. Per-surface *guidance* text intentionally
 * differs (a strict-mode throw tells the operator what to fix; a warning
 * tells them the run continued and how to re-lock) — only the reason phrases
 * are centralized here.
 */
export function describeIntegrityFailure(member: string, reason: SkillIntegrityFailure): string {
  switch (reason) {
    case 'corrupt':
      return `agenthood.lock for "${member}" is corrupt`
    case 'drift':
      return `SKILL.md for "${member}" drifted from agenthood.lock`
    case 'no-lockfile':
      return `no agenthood.lock entry for "${member}"`
    case 'missing':
      return `SKILL.md for "${member}" is missing on disk`
  }
}

/** Thrown by the caller when strict mode turns a detected integrity failure into a hard block. */
export class SkillIntegrityError extends Error {
  constructor(member: string, reason: SkillIntegrityFailure) {
    // only no-lockfile means the gate itself is off; missing means the lockfile
    // has an entry but the SKILL.md file is gone, so the gate IS on
    const gate = reason === 'no-lockfile'
      ? 'refusing to run (strict mode) — the integrity gate is OFF'
      : 'refusing to run (strict mode)'
    const guidance: Record<SkillIntegrityFailure, string> = {
      corrupt: 'Fix or regenerate the lockfile.',
      drift: 'Run `agenthood verify --update-lock` if the edit is intentional.',
      'no-lockfile': 'Run `agenthood verify` to generate the lockfile.',
      missing: 'Restore the skill file or regenerate the lockfile.',
    }
    super(`[mind-virus] ${describeIntegrityFailure(member, reason)} — ${gate}. ${guidance[reason]}`)
    this.name = 'SkillIntegrityError'
  }
}

/**
 * Records a drift/corruption detection durably into decisions + provenance so
 * the audit trail survives regardless of whether the caller warns or blocks
 * next. Non-fatal: a recording failure never aborts the member run.
 */
export async function recordSkillIntegrityDrift(
  context: ExecutionContext,
  member: string,
  reason: SkillIntegrityFailure = 'drift',
): Promise<void> {
  const gateNote = reason === 'no-lockfile' ? ' — integrity gate is OFF' : ''
  const detail = `${describeIntegrityFailure(member, reason)}${gateNote}`
  try {
    const timestamp = new Date().toISOString()
    const id = `dec-${Date.now()}-${randomUUID()}`
    await context.memory.decisions.record({
      id,
      timestamp,
      member,
      task: 'skill-integrity-check',
      decision: `[mind-virus] ${detail}`,
      rationale: 'Injection-time persistence-vector check (ADR-020). Verify the file and lockfile; run `agenthood verify --update-lock` if intentional.',
      alternatives: [],
      outcome: 'warning',
      tags: ['mind-virus', 'integrity'],
      confidence: 1,
      decisionMaker: member,
    })
    const safeId = `skill-integrity-${member}`
    await context.memory.provenance.track({
      entityId: safeId,
      entityType: 'skill-integrity-check',
      activityId: `skill-integrity:${member}`,
      agentId: member,
      role: 'system',
      sourceDocument: `[mind-virus] ${detail}`,
      timestamp,
      confidence: 1,
      metadata: { decisionId: id },
    })
  } catch {
    // best-effort by design: the drift warning itself already surfaced
  }
}
