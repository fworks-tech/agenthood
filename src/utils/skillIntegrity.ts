import { readFileSync, existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import type { ExecutionContext } from '../core/ExecutionContext.ts'
import { contentHash } from './hash.ts'
import { loadLockfile } from './lockfile.ts'

export type SkillIntegrityStatus = 'clean' | 'drift' | 'no-lockfile' | 'missing'

export interface SkillIntegrityOptions {
  lockfilePath?: string
}

/**
 * Injection-time persistence-vector check (ADR-020): the member SKILL.md is
 * injected into the system prompt like the paper's SOUL.md, so hash it against
 * agenthood.lock at prompt-assembly time. Drift means the injected file may
 * have been tampered with (a mind-virus persistence vector). Pure — never
 * throws; callers decide whether drift is a hard block.
 */
export function checkSkillIntegrity(
  member: string,
  skillPath: string,
  options: SkillIntegrityOptions = {},
): SkillIntegrityStatus {
  const lockfile = loadLockfile(options.lockfilePath ?? process.cwd())
  if (!lockfile || !lockfile.members[member]) return 'no-lockfile'
  if (!existsSync(skillPath)) return 'missing'
  const current = contentHash(readFileSync(skillPath, 'utf-8'))
  if (current === lockfile.members[member].version) return 'clean'
  return 'drift'
}

/** Thrown by the caller when strict mode turns detected drift into a hard block. */
export class SkillIntegrityError extends Error {
  constructor(member: string) {
    super(
      `[mind-virus] SKILL.md for "${member}" drifted from agenthood.lock — refusing to run (strict mode). Run \`agenthood verify --update-lock\` if the edit is intentional.`,
    )
    this.name = 'SkillIntegrityError'
  }
}

/**
 * Records a drift detection durably into decisions + provenance so the audit
 * trail survives regardless of whether the caller warns or blocks next.
 * Non-fatal: a recording failure never aborts the member run.
 */
export async function recordSkillIntegrityDrift(
  context: ExecutionContext,
  member: string,
): Promise<void> {
  try {
    const timestamp = new Date().toISOString()
    const id = `dec-${Date.now()}-${randomUUID()}`
    await context.memory.decisions.record({
      id,
      timestamp,
      member,
      task: 'skill-integrity-check',
      decision: `[mind-virus] SKILL.md for "${member}" drifted from agenthood.lock`,
      rationale: 'Injection-time persistence-vector check (ADR-020). Verify the file; run `agenthood verify --update-lock` if intentional.',
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
      sourceDocument: `[mind-virus] SKILL.md for "${member}" drifted from agenthood.lock`,
      timestamp,
      confidence: 1,
      metadata: { decisionId: id },
    })
  } catch {
    // best-effort by design: the drift warning itself already surfaced
  }
}
