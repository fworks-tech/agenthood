import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { ExecutionContext } from '../core/ExecutionContext.ts'
import { contentHash } from './hash.ts'

export type SkillIntegrityStatus = 'clean' | 'drift' | 'corrupt' | 'no-lockfile' | 'missing'
/** Reasons that surface the integrity gate as inactive or violated — everything except 'clean'. */
export type SkillIntegrityFailure = 'drift' | 'corrupt' | 'no-lockfile' | 'missing'

export interface SkillIntegrityOptions {
  lockfilePath?: string
}

/**
 * Injection-time persistence-vector check (ADR-020): the member SKILL.md is
 * injected into the system prompt like the paper's SOUL.md, so hash it against
 * agenthood.lock at prompt-assembly time. Drift means the injected file may
 * have been tampered with (a mind-virus persistence vector); a corrupt
 * lockfile is treated as suspicious rather than silently skipped, since
 * tampering may also leave the lock unreadable. Pure — never throws; callers
 * decide whether drift/corruption is a hard block.
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
  let lockfile: { members?: Record<string, { version: string }> }
  try {
    lockfile = JSON.parse(raw) as { members?: Record<string, { version: string }> }
  } catch {
    return 'corrupt'
  }
  if (!lockfile.members?.[member]) return 'no-lockfile'
  if (!existsSync(skillPath)) return 'missing'
  const current = contentHash(readFileSync(skillPath, 'utf-8'))
  if (current === lockfile.members[member].version) return 'clean'
  return 'drift'
}

/**
 * Single source for mapping an integrity failure reason to its canonical
 * human phrase. Every consumer (SkillIntegrityError, the durable record, and
 * the console warning) composes from this so the operator-facing vocabulary
 * cannot drift between spellings.
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
    const gate = reason === 'no-lockfile' || reason === 'missing'
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
