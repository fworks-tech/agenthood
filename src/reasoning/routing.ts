import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** The Mediator's four intent buckets, slugs for the prose in
 * skills/mediator/SKILL.md "Classifying Intent". An intent outside this
 * set is bucket 1 by definition — a prompt that fits none of the four is
 * under-specified, not a fifth kind.
 */
export const ROUTING_INTENTS = [
  'ambiguous',
  'capacity-sensitive',
  'entry-violation',
  'clear-specialist',
] as const

export type RoutingIntent = (typeof ROUTING_INTENTS)[number]

/** Below this the Mediator must run Parallel Evaluation or escalate to The
 * Strategist before routing. Kept here so the threshold lives in one place —
 * SKILL.md, the Steward's own cascade, and this validator cannot drift.
 */
export const PARALLEL_EVALUATION_THRESHOLD = 70

export type ParallelEvaluation = {
  asked: string[]
  responses: Array<{ member: string; agrees: boolean; classification: RoutingIntent }>
  outcome: 'consensus' | 'disagreement' | 'split'
}

/** One routing decision, exactly as members write it to
 * `.agenthood/routing/<id>.json`. Deliberately not a DecisionLogEntry: that
 * type carries `task`/`decision`/`rationale`/`outcome`/`tags` free-text, and
 * DecisionLog.loadCache() casts every .json in its own directory to that
 * shape — matchEntry() then dereferences entry.tags unguarded. A second record
 * kind in that directory crashes search(). Separate home, separate shape.
 *
 * Field names are snake_case because this is the on-disk contract members
 * hand-write, not a TS-internal shape.
 */
export type RoutingDecision = {
  id: string
  timestamp: string
  member: string
  intent: RoutingIntent
  confidence: number
  confidence_factors: string[]
  target: string
  reasoning: string
  alternatives_considered: string[]
  cascade_applied: boolean
  parallel_evaluation: ParallelEvaluation | null
}

const REQUIRED_STRINGS = ['id', 'timestamp', 'member', 'target', 'reasoning'] as const

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Enforces what the member docs promise: intent is one of the four buckets,
 * confidence is 0-100, target is a registered member, and a sub-threshold
 * score actually triggered the cascade. Returns one message per violation, so
 * a member can fix every problem in one pass. Unknown extra keys are ignored —
 * the docs forbid free-text beyond `reasoning`, but an extra key is noise, not
 * a routing error, and dropping records over it would lose the audit trail.
 */
export function validateRoutingDecision(raw: unknown, knownMembers: readonly string[]): string[] {
  const errors: string[] = []

  if (!isPlainObject(raw)) return ['record is not a JSON object']

  for (const field of REQUIRED_STRINGS) {
    const value = raw[field]
    if (typeof value !== 'string' || value.length === 0) {
      errors.push(`${field} must be a non-empty string`)
    }
  }

  if (!raw.id || (typeof raw.id === 'string' && !/^[A-Za-z0-9_-]+$/.test(raw.id))) {
    errors.push('id must match [A-Za-z0-9_-]+ so it can name a file')
  }

  if (!ROUTING_INTENTS.includes(raw.intent as RoutingIntent)) {
    errors.push(`intent must be one of: ${ROUTING_INTENTS.join(', ')}`)
  }

  if (typeof raw.confidence !== 'number' || !Number.isInteger(raw.confidence) ||
      raw.confidence < 0 || raw.confidence > 100) {
    errors.push('confidence must be an integer 0-100')
  }

  if (typeof raw.target === 'string' && !knownMembers.includes(raw.target)) {
    errors.push(`target "${raw.target}" is not a registered member`)
  }

  for (const field of ['confidence_factors', 'alternatives_considered'] as const) {
    const value = raw[field]
    if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
      errors.push(`${field} must be an array of strings`)
    }
  }

  if (typeof raw.cascade_applied !== 'boolean') {
    errors.push('cascade_applied must be a boolean')
  }

  const pe = raw.parallel_evaluation
  if (pe !== null) {
    if (!isPlainObject(pe)) {
      errors.push('parallel_evaluation must be an object or null')
    } else {
      if (!Array.isArray(pe.asked) || pe.asked.length < 2) {
        errors.push('parallel_evaluation must ask at least two other members')
      }
      if (!Array.isArray(pe.responses)) {
        errors.push('parallel_evaluation.responses must be an array')
      }
      if (!['consensus', 'disagreement', 'split'].includes(pe.outcome as string)) {
        errors.push('parallel_evaluation.outcome must be consensus, disagreement or split')
      }
    }
  }

  // The substantive claim: a low-confidence score that did not trigger the
  // cascade is a guess that claimed to be a decision.
  const lowConfidence = typeof raw.confidence === 'number' && raw.confidence < PARALLEL_EVALUATION_THRESHOLD
  if (lowConfidence && raw.cascade_applied === false) {
    errors.push(`confidence below ${PARALLEL_EVALUATION_THRESHOLD} requires cascade_applied: true`)
  }
  if (lowConfidence && pe === null) {
    errors.push(`confidence below ${PARALLEL_EVALUATION_THRESHOLD} requires a parallel_evaluation or an escalation to The Strategist`)
  }

  return errors
}

/**
 * Persists one routing decision to `routingDir/<id>.json`, refusing to write
 * records that would fail `agenthood verify`. Fail-closed: a violating record
 * throws with every violation listed instead of corrupting the audit trail.
 * Returns the written file path.
 */
export function writeRoutingDecision(routingDir: string, decision: RoutingDecision, knownMembers: readonly string[]): string {
  const errors = validateRoutingDecision(decision, knownMembers)
  if (errors.length > 0) {
    throw new Error(`refusing to write invalid routing decision "${decision.id}": ${errors.join('; ')}`)
  }
  mkdirSync(routingDir, { recursive: true })
  const filePath = join(routingDir, `${decision.id}.json`)
  writeFileSync(filePath, JSON.stringify(decision, null, 2), 'utf8')
  return filePath
}

export type RoutingAudit = { file: string; errors: string[] }

/** Reads and validates every routing record in `routingDir`. A missing
 * directory is not an error — a Society that has not routed anything yet is
 * in the correct state, and CI has no .agenthood at all.
 */
export function auditRoutingRecords(routingDir: string, knownMembers: readonly string[]): RoutingAudit[] {
  if (!existsSync(routingDir)) return []

  return readdirSync(routingDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((file) => {
      try {
        return { file, errors: validateRoutingDecision(JSON.parse(readFileSync(join(routingDir, file), 'utf8')), knownMembers) }
      } catch (err) {
        return { file, errors: [`unreadable JSON: ${err instanceof Error ? err.message : String(err)}`] }
      }
    })
    .filter((r) => r.errors.length > 0)
}
