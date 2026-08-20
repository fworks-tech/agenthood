import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { ExecutionContext } from '../core/ExecutionContext.ts'
import { contentHash } from './hash.ts'

export type SkillIntegrityStatus = 'clean' | 'drift' | 'corrupt' | 'no-lockfile' | 'missing'

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

/** Thrown by the caller when strict mode turns detected drift/corruption into a hard block. */
export class SkillIntegrityError extends Error {
  constructor(member: string, reason: 'drift' | 'corrupt') {
    super(
      reason === 'corrupt'
        ? `[mind-virus] agenthood.lock for "${member}" is corrupt — refusing to run (strict mode). Fix or regenerate the lockfile.`
        : `[mind-virus] SKILL.md for "${member}" drifted from agenthood.lock — refusing to run (strict mode). Run \`agenthood verify --update-lock\` if the edit is intentional.`,
    )
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
  reason: 'drift' | 'corrupt' = 'drift',
): Promise<void> {
  const detail = reason === 'corrupt'
    ? `agenthood.lock for "${member}" is corrupt`
    : `SKILL.md for "${member}" drifted from agenthood.lock`
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
