import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { basename, join } from 'node:path'
import { userError } from '../core/cliError.ts'
import { loadObservabilityConfig, resolveTraceStorePath } from '../core/TraceStore.ts'
import { MEMBER_NAMES } from '../members.ts'
import { ProvenanceStore } from '../memory/ProvenanceStore.ts'
import { auditRoutingRecords } from '../reasoning/routing.ts'
import { resolveSince } from './args.ts'
import type { CommandDescriptor } from './types.ts'
import type { TraceEnvelope } from '../core/types.ts'

interface DecisionEntry {
  id: string
  timestamp: string
  member: string
  task: string
  decision: string
  outcome: string
}

interface ProvenanceEntry {
  entityId: string
  timestamp: string
  agentId: string
  activityId: string
  sequenceId?: number
  metadata?: { decisionId?: string }
}

interface RoutingEntry {
  id: string
  timestamp: string
  member: string
  intent: string
  confidence: number
  target: string
}

/** The per-run numbers a trace carries, attached to the provenance event it belongs to. */
interface TraceMetrics {
  timestamp: string
  durationMs: number
  cost: number
  tokens: number
  /** Optional: the loader validates correlationId and timestamp only, so a line can lack the rest. */
  status?: TraceEnvelope['status']
  qualityScore?: number | null
  model?: string
}

interface AuditEvent {
  timestamp: string
  kind: 'decision' | 'provenance' | 'routing'
  member: string
  sequence?: number
  id: string
  summary: string
  trace?: TraceMetrics
}

interface AuditFlags {
  member?: string
  since?: string
  json: boolean
  strict: boolean
  clear: boolean
  help: boolean
}

const HELP = `
  agenthood audit: verify what the Society decided, in the order it happened

  Reads .agenthood/decisions, .agenthood/provenance, and .agenthood/routing,
  merges them into one timeline, and verifies the provenance hash chain.
  Provenance events carry the run's duration, cost and tokens when the trace
  store has them; a corrupt trace line is reported without failing the audit.

  --member <name>   Only events from one member
  --since <time>    Only events newer than <time> (ISO date or 1h/24h/7d)
  --json            Machine-readable output
  --clear           Archive the current trail to .agenthood/archive/<timestamp>/
                    and start clean; never deletes
  --strict          Exit 1 on a broken chain, an orphan, a missing decision,
                    an invalid routing record, or an unreadable trail file
`

/**
 * Reads a trail directory. A file that cannot be parsed or lacks the fields the
 * audit needs is reported, not skipped: silently dropping it would let a
 * corrupted trail pass as complete.
 */
function loadRecords<T>(
  dir: string,
  label: string,
  accept: (entry: Record<string, unknown>) => boolean,
  problems: string[],
): T[] {
  if (!existsSync(dir)) return []
  const entries: T[] = []
  for (const file of readdirSync(dir).filter((name) => name.endsWith('.json'))) {
    let parsed: unknown
    try {
      parsed = JSON.parse(readFileSync(join(dir, file), 'utf8'))
    } catch (error) {
      problems.push(`${label}/${file}: ${(error as Error).message}`)
      continue
    }
    if (parsed === null || typeof parsed !== 'object' || !accept(parsed as Record<string, unknown>)) {
      problems.push(`${label}/${file}: missing required fields`)
      continue
    }
    entries.push(parsed as T)
  }
  return entries
}

function parseFlags(args: string[]): AuditFlags {
  const flags: AuditFlags = { json: false, strict: false, clear: false, help: false }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    switch (arg) {
      case '--member':
        flags.member = args[++i]
        break
      case '--since':
        flags.since = resolveSince(args[++i] ?? '')
        break
      case '--json':
        flags.json = true
        break
      case '--strict':
        flags.strict = true
        break
      case '--clear':
        flags.clear = true
        break
      case '--help':
      case '-h':
        flags.help = true
        break
      default:
        userError(`Unknown flag: "${arg}"`, { fix: 'Run "agenthood audit --help" to see the flags.' })
    }
  }
  return flags
}

function truncate(text: string, max: number): string {
  const single = String(text ?? '').replace(/\s+/g, ' ').trim()
  return single.length > max ? `${single.slice(0, max - 1)}…` : single
}

/**
 * Streams the trace store next to the trail and indexes it by correlationId,
 * which equals the provenance entityId for the same run. Traces only decorate
 * the timeline: an unreadable store or line never fails the audit, because a
 * missing metric is not a missing decision. Duplicate lines for one run keep
 * the newest timestamp, so file order cannot change the result.
 */
async function loadTraces(path: string, unreadable: string[]): Promise<Map<string, TraceMetrics>> {
  const byCorrelation = new Map<string, TraceMetrics>()
  if (!existsSync(path)) return byCorrelation
  const reader = createInterface({ input: createReadStream(path, 'utf8'), crlfDelay: Infinity })
  let lineNo = 0
  try {
    for await (const line of reader) {
      lineNo++
      if (line.trim() === '') continue
      let parsed: TraceEnvelope
      try {
        parsed = JSON.parse(line) as TraceEnvelope
      } catch {
        unreadable.push(`line ${lineNo}: invalid JSON`)
        continue
      }
      if (parsed.entryType === 'log') continue
      if (typeof parsed?.correlationId !== 'string' || typeof parsed?.timestamp !== 'string') {
        unreadable.push(`line ${lineNo}: missing required fields`)
        continue
      }
      const existing = byCorrelation.get(parsed.correlationId)
      // Ties fall back to file order, where the last line is the most recent write.
      if (existing && existing.timestamp > parsed.timestamp) continue
      byCorrelation.set(parsed.correlationId, {
        durationMs: parsed.durationMs,
        cost: parsed.cost,
        tokens: parsed.tokenCount?.total ?? 0,
        status: parsed.status,
        qualityScore: parsed.qualityScore,
        model: parsed.model,
        timestamp: parsed.timestamp,
      })
    }
  } catch (error) {
    unreadable.push(`store: ${(error as Error).message}`)
  } finally {
    reader.close()
  }
  return byCorrelation
}

/** `2.0s · $0.0031 · 20922 tok`, plus the status when the run did not succeed. */
function formatTrace(trace: TraceMetrics): string {
  const parts: string[] = []
  if (typeof trace.durationMs === 'number') parts.push(`${(trace.durationMs / 1000).toFixed(1)}s`)
  if (typeof trace.cost === 'number') parts.push(`$${trace.cost.toFixed(4)}`)
  if (typeof trace.tokens === 'number') parts.push(`${trace.tokens} tok`)
  if (trace.status && trace.status !== 'success') parts.push(trace.status)
  return parts.join(' · ')
}

const TRAIL_DIRS = ['decisions', 'provenance', 'routing', 'trajectories', 'metrics'] as const

/**
 * Moves the trail into .agenthood/archive/<timestamp>/ so a demo or a task
 * starts clean without destroying evidence. Rename, never delete: the archive
 * stays inside the project and the next audit sees an empty trail.
 */
function clearTrail(cwd: string, json: boolean): void {
  const root = join(cwd, '.agenthood')
  const tracesPath = resolveTraceStorePath(cwd, loadObservabilityConfig(cwd))
  const targets = [
    ...TRAIL_DIRS.map((name) => join(root, name)),
    tracesPath,
    join(root, 'costs.jsonl'),
  ].filter((path) => {
    if (!existsSync(path)) return false
    return !statSync(path).isDirectory() || readdirSync(path).length > 0
  })

  if (targets.length === 0) {
    if (json) console.log(JSON.stringify({ cleared: false, reason: 'empty' }, null, 2))
    else console.log('  Trail is already empty.')
    return
  }

  const archivePath = join(root, 'archive', new Date().toISOString().replace(/[:.]/g, '-'))
  mkdirSync(archivePath, { recursive: true })
  const archived = targets.map((target) => {
    const name = basename(target)
    renameSync(target, join(archivePath, name))
    return name
  })

  if (json) {
    console.log(JSON.stringify({ cleared: true, archivePath, archived }, null, 2))
    return
  }
  console.log(`  Archived ${archived.length} trail entr${archived.length === 1 ? 'y' : 'ies'} to ${archivePath}`)
}

/** Ordered, verified view of the decision trail. */
export async function audit(args: string[] = [], cwd: string = process.cwd()): Promise<void> {
  const flags = parseFlags(args)
  if (flags.help) {
    console.log(HELP)
    return
  }
  if (flags.clear) {
    clearTrail(cwd, flags.json)
    return
  }

  const root = join(cwd, '.agenthood')
  const problems: string[] = []
  const decisions = loadRecords<DecisionEntry>(
    join(root, 'decisions'),
    'decisions',
    (entry) => typeof entry.id === 'string' && typeof entry.member === 'string' && typeof entry.timestamp === 'string',
    problems,
  )
  const provenance = loadRecords<ProvenanceEntry>(
    join(root, 'provenance'),
    'provenance',
    (entry) => typeof entry.entityId === 'string' && typeof entry.timestamp === 'string',
    problems,
  )
  const routing = loadRecords<RoutingEntry>(
    join(root, 'routing'),
    'routing',
    (entry) => typeof entry.id === 'string' && typeof entry.timestamp === 'string',
    problems,
  )
  const routingFailures = auditRoutingRecords(join(root, 'routing'), MEMBER_NAMES)
  const traceProblems: string[] = []
  const traces = await loadTraces(resolveTraceStorePath(cwd, loadObservabilityConfig(cwd)), traceProblems)

  const since = flags.since
  const wanted = (member: string) => !flags.member || member === flags.member
  const fresh = (timestamp: string) => !since || timestamp >= since

  const events: AuditEvent[] = []
  for (const d of decisions) {
    if (!wanted(d.member) || !fresh(d.timestamp)) continue
    events.push({
      timestamp: d.timestamp,
      kind: 'decision',
      member: d.member,
      id: d.id,
      summary: `${d.outcome}: ${truncate(d.decision, 70)}`,
    })
  }
  for (const p of provenance) {
    if (!wanted(p.agentId) || !fresh(p.timestamp)) continue
    const trace = traces.get(p.entityId)
    events.push({
      timestamp: p.timestamp,
      kind: 'provenance',
      member: p.agentId,
      sequence: p.sequenceId,
      id: p.entityId,
      summary: p.activityId,
      ...(trace ? { trace } : {}),
    })
  }
  for (const r of routing) {
    if (!wanted(r.member) || !fresh(r.timestamp)) continue
    events.push({
      timestamp: r.timestamp,
      kind: 'routing',
      member: r.member,
      id: r.id,
      summary: `${r.intent} ${r.confidence}% → ${r.target}`,
    })
  }
  events.sort((a, b) => (a.timestamp === b.timestamp ? (a.sequence ?? 0) - (b.sequence ?? 0) : a.timestamp < b.timestamp ? -1 : 1))

  const chain = await new ProvenanceStore({ provenanceDir: join(root, 'provenance') }).verifyChain()

  const decisionIds = new Set(decisions.map((d) => d.id))
  const linked = new Set(provenance.map((p) => p.metadata?.decisionId).filter(Boolean) as string[])
  const orphans = provenance
    .filter((p) => p.metadata?.decisionId && !decisionIds.has(p.metadata.decisionId))
    .filter((p) => wanted(p.agentId) && fresh(p.timestamp))
  const missing = decisions.filter((d) => !linked.has(d.id)).filter((d) => wanted(d.member) && fresh(d.timestamp))
  const ok = chain.valid && routingFailures.length === 0 && orphans.length === 0 && missing.length === 0 && problems.length === 0

  if (flags.json) {
    console.log(
      JSON.stringify(
        {
          root: cwd,
          events,
          chain,
          counts: { decisions: decisions.length, provenance: provenance.length, routing: routing.length, traces: traces.size },
          orphans: orphans.map((p) => p.entityId),
          decisionsWithoutProvenance: missing.map((d) => d.id),
          routingFailures,
          unreadable: problems,
          unreadableTraces: traceProblems,
          ok,
        },
        null,
        2,
      ),
    )
    if (flags.strict && !ok) process.exitCode = 1
    return
  }

  console.log(`\n  Audit: ${cwd}`)
  console.log(
    `  ${events.length} event(s): ${decisions.length} decision(s), ${provenance.length} provenance, ${routing.length} routing\n`,
  )
  for (const event of events) {
    const sequence = event.sequence !== undefined ? `#${event.sequence}` : '  '
    const metrics = event.trace ? `  ·  ${formatTrace(event.trace)}` : ''
    console.log(`  ${event.timestamp}  ${event.kind.padEnd(10)} ${sequence.padEnd(4)} ${event.member.padEnd(12)} ${event.summary}${metrics}`)
  }

  console.log(`\n  Provenance chain: ${chain.valid ? 'valid' : `BROKEN at ${chain.brokenAt ?? 'unknown'}`}`)
  if (!chain.valid && chain.detail) console.log(`  ${chain.detail}`)
  for (const orphan of orphans) console.log(`  ⚠ provenance without decision: ${orphan.entityId}`)
  for (const decision of missing) console.log(`  ⚠ decision without provenance: ${decision.id}`)
  for (const failure of routingFailures) console.log(`  ⚠ invalid routing record ${failure.file}: ${failure.errors.join('; ')}`)
  for (const problem of problems) console.log(`  ⚠ unreadable trail file ${problem}`)
  for (const problem of traceProblems) console.log(`  ⚠ unreadable trace ${problem}`)
  if (ok) console.log('  ✓ The trail is complete and the chain is intact.')
  console.log()

  if (flags.strict && !ok) process.exitCode = 1
}

export const command: CommandDescriptor = {
  name: 'audit',
  description: 'Verify the decision trail: ordered events, hash chain, gaps',
  handler: (args) => audit(args),
}
