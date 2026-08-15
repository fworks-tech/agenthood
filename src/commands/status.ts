import { existsSync, readFileSync, readdirSync } from 'node:fs'
import type { CommandDescriptor } from './types.ts'
import { join } from 'node:path'
import type { MetricsEntry } from '../memory/MetricsCollector.ts'
import { collectMemberMetrics } from './collectMetrics.ts'
import { contentHash } from '../utils/hash.ts'
import { loadLockfile } from '../utils/lockfile.ts'
import { resolveSkillsDir } from '../members.ts'
import { JSONFileTraceStore, loadObservabilityConfig, resolveTraceStorePath } from '../core/TraceStore.ts'
import { formatDuration } from '../utils/formatDuration.ts'
import { summarizeMemberWindows } from '../core/traceSummary.ts'
import type { TraceWindow } from '../core/traceSummary.ts'
import type { Anomaly } from '../core/AnomalyDetector.ts'
import { EpisodeLearner } from '../evals/EpisodeLearner.ts'
import { LanceDBStore } from '../memory/VectorStore.ts'

function formatPct(rate: number | null): string {
  if (rate === null) return '—'
  return `${(rate * 100).toFixed(0)}%`
}

function printPlain(memberCount: number, decisionCount: number, lockStatus: string, memoryInit: boolean, allStats: MetricsEntry[]): void {
  console.log('\n  Agenthood Status\n')
  console.log(`  Members:     ${memberCount}`)
  console.log(`  Decisions:   ${decisionCount}`)
  console.log(`  Lockfile:    ${lockStatus}`)
  console.log(`  Memory:      ${memoryInit ? 'initialized' : 'not initialized'}\n`)

  if (allStats.length > 0) {
    console.log('  Member Metrics:\n')
    console.log(`  ${'Member'.padEnd(20)} ${'Runs'.padEnd(6)} ${'Success'.padEnd(8)} ${'Avg Duration'.padEnd(14)} Last Run`)
    console.log(`  ${''.padEnd(20, '-')} ${''.padEnd(6, '-')} ${''.padEnd(8, '-')} ${''.padEnd(14, '-')} ${''.padEnd(24, '-')}`)
    for (const entry of allStats) {
      const avgDur = formatDuration(entry.metrics.invocations > 0 ? Math.round(entry.metrics.totalDurationMs / entry.metrics.invocations) : 0)
      const lastRun = entry.metrics.lastRun ? new Date(entry.metrics.lastRun).toLocaleDateString() : '—'
      const successRate = formatPct(entry.metrics.invocations > 0 ? entry.metrics.successes / entry.metrics.invocations : null)
      const name = entry.member.length > 18 ? entry.member.slice(0, 18) + '\u2026' : entry.member
      console.log(`  ${name.padEnd(20)} ${String(entry.metrics.invocations).padEnd(6)} ${successRate.padEnd(8)} ${avgDur.padEnd(14)} ${lastRun}`)
    }
    console.log()
  }
}

function printJson(memberCount: number, decisionCount: number, lockStatus: string, memoryInit: boolean, allStats: MetricsEntry[]): void {
  const output = {
    members: memberCount,
    decisions: decisionCount,
    lockfile: lockStatus,
    memory: memoryInit,
    metrics: allStats,
  }
  console.log(JSON.stringify(output, null, 2))
}

function reportDrift(cwd: string): void {
  const skillsBase = resolveSkillsDir(cwd)
  const lock = loadLockfile(cwd)
  if (!lock) {
    console.log('\n  No lockfile found. Run `agenthood verify --update-lock` first.\n')
    process.exit(0)
  }
  const driftFound: string[] = []
  const members = readdirSync(skillsBase, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
  for (const member of members) {
    const skillPath = join(skillsBase, member, `${member}.md`)
    if (!existsSync(skillPath)) continue
    const content = readFileSync(skillPath, 'utf8')
    const currentHash = contentHash(content)
    const lockedHash = lock.members[member]?.version
    if (lockedHash && currentHash !== lockedHash) {
      driftFound.push(member)
    }
  }
  if (driftFound.length === 0) {
    console.log('\n  No drift detected \u2014 all members match lockfile.\n')
  } else {
    console.log(`\n  Drift detected in ${driftFound.length} member(s):\n`)
    for (const m of driftFound) {
      console.log(`    ! ${m}`)
    }
    console.log()
  }
  process.exit(0)
}

interface ProjectStats {
  memberCount: number
  decisionCount: number
  lockStatus: string
  memoryInit: boolean
}

function collectProjectStats(cwd: string): ProjectStats {
  const configPath = join(cwd, '.agenthood', 'config.json')
  let memberCount = 0
  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf8'))
      memberCount = Array.isArray(config.members) ? config.members.length : 0
    } catch {
      memberCount = 0
    }
  }

  const decisionsDir = join(cwd, '.agenthood', 'decisions')
  const decisionCount = existsSync(decisionsDir)
    ? readdirSync(decisionsDir).filter((f) => f.endsWith('.json')).length
    : 0

  const lockPath = join(cwd, 'agenthood.lock')
  let lockStatus = 'absent'
  if (existsSync(lockPath)) {
    try {
      const lock = JSON.parse(readFileSync(lockPath, 'utf8'))
      lockStatus = `valid (${Object.keys(lock.members || {}).length} members locked)`
    } catch {
      lockStatus = 'invalid'
    }
  }

  const memoryInit = existsSync(join(cwd, '.agenthood', 'memory'))
  return { memberCount, decisionCount, lockStatus, memoryInit }
}

function runWatchLoop(cwd: string, stats: ProjectStats, display: (m: number, d: number, l: string, mi: boolean, s: MetricsEntry[]) => void): void {
  const interval = setInterval(() => {
    const fresh = collectMemberMetrics(join(cwd, '.agenthood', 'metrics'))
    display(stats.memberCount, stats.decisionCount, stats.lockStatus, stats.memoryInit, fresh)
  }, 5000)
  process.on('SIGINT', () => { clearInterval(interval); process.exit(0) })
  process.on('SIGTERM', () => { clearInterval(interval); process.exit(0) })
}

interface PersistedPatternCounts {
  learned: number
  antipatterns: number
  byMember: Record<string, { learned: number; antipatterns: number }>
}

function safeParseOutcome(content: string | undefined): { member?: string } | null {
  if (!content) return null
  try {
    const parsed = JSON.parse(content) as { member?: string }
    return typeof parsed === 'object' && parsed !== null ? parsed : null
  } catch {
    return null
  }
}

async function loadPersistedPatterns(cwd: string): Promise<PersistedPatternCounts> {
  const empty: PersistedPatternCounts = { learned: 0, antipatterns: 0, byMember: {} }
  const store = new LanceDBStore(1536)
  try {
    await store.connect(join(cwd, '.agenthood', 'memory'))
    const [learned, antipatterns] = await Promise.all([
      store.getByKeyPrefix('ltm:learnings'),
      store.getByKeyPrefix('ltm:antipatterns'),
    ])
    store.disconnect()

    const byMember: PersistedPatternCounts['byMember'] = {}
    for (const [records, kind] of [
      [learned, 'learned'],
      [antipatterns, 'antipatterns'],
    ] as const) {
      for (const record of records) {
        const outcome = safeParseOutcome(record.content)
        const member = outcome?.member ?? 'unknown'
        const entry = byMember[member] ?? { learned: 0, antipatterns: 0 }
        entry[kind]++
        byMember[member] = entry
      }
    }
    return { learned: learned.length, antipatterns: antipatterns.length, byMember }
  } catch {
    return empty
  }
}

async function printLearnerStatus(cwd: string, json: boolean): Promise<void> {
  const learner = new EpisodeLearner()
  const status = learner.getStatus()
  const persisted = await loadPersistedPatterns(cwd)

  if (json) {
    console.log(JSON.stringify({ session: status, persisted }, null, 2))
    return
  }

  console.log(`\n  EpisodeLearner\n`)
  console.log(`  Session episodes:  ${status.totalEpisodes} (high ${status.highScoreCount} / mid ${status.midScoreCount} / low ${status.lowScoreCount})`)
  console.log(`  Confidence trend:  ${status.confidenceTrend}`)
  console.log(`  Last update:       ${status.lastUpdate ?? 'never'}`)
  console.log(`  Persisted patterns: ${persisted.learned} learned, ${persisted.antipatterns} anti-patterns\n`)
  const members = Object.keys(persisted.byMember).sort()
  if (members.length > 0) {
    console.log(`  Per member:\n`)
    for (const member of members) {
      const counts = persisted.byMember[member]
      console.log(`    ${member.padEnd(20)} ${counts.learned} learned, ${counts.antipatterns} anti-patterns`)
    }
    console.log()
  } else {
    console.log('  No persisted patterns yet. Evaluation with scores activates the learner.\n')
  }
}

function printMemberWindows(member: string, windows: TraceWindow[], json: boolean): void {
  if (json) {
    const payload: Record<string, unknown> = { member }
    for (const w of windows) payload[w.label] = w.summary
    console.log(JSON.stringify(payload, null, 2))
    return
  }

  console.log(`\n  Trace Summary — ${member}\n`)
  console.log(`  ${'Window'.padEnd(8)} ${'Calls'.padEnd(7)} ${'Success'.padEnd(9)} ${'Errors'.padEnd(7)} ${'Avg Dur'.padEnd(10)} ${'Cost'.padEnd(10)} Tokens`)
  console.log(`  ${''.padEnd(8, '-')} ${''.padEnd(7, '-')} ${''.padEnd(9, '-')} ${''.padEnd(7, '-')} ${''.padEnd(10, '-')} ${''.padEnd(10, '-')} ${''.padEnd(10, '-')}`)
  for (const w of windows) {
    if (!w.summary) {
      console.log(`  ${w.label.padEnd(8)} ${String(0).padEnd(7)} ${String(0).padEnd(9)} ${String(0).padEnd(7)} ${'—'.padEnd(10)} ${'$0.0000'.padEnd(10)} 0`)
      continue
    }
    const s = w.summary
    const quality = s.avgQuality === null ? '—' : s.avgQuality.toFixed(2)
    console.log(
      `  ${w.label.padEnd(8)} ${String(s.callCount).padEnd(7)} ${String(s.successCount).padEnd(9)} ${String(s.errorCount).padEnd(7)} ${formatDuration(s.avgDurationMs).padEnd(10)} $${s.totalCost.toFixed(4).padEnd(9)} ${s.totalTokens.total.toLocaleString()} (${quality})`,
    )
  }
  console.log()
}

async function printAlerts(cwd: string, json: boolean, limit: number): Promise<void> {
  const alertsPath = join(cwd, '.agenthood', 'alerts', 'anomalies.ndjson')
  if (!existsSync(alertsPath)) {
    console.log('\n  No anomaly alerts recorded yet.\n')
    return
  }

  const anomalies: Anomaly[] = []
  for (const line of readFileSync(alertsPath, 'utf8').split('\n')) {
    if (!line.trim()) continue
    try {
      anomalies.push(JSON.parse(line) as Anomaly)
    } catch {
      // skip corrupt lines
    }
  }
  const recent = anomalies.slice(-limit)

  if (json) {
    console.log(JSON.stringify({ count: anomalies.length, alerts: recent }, null, 2))
    return
  }

  if (recent.length === 0) {
    console.log('\n  No anomaly alerts recorded yet.\n')
    return
  }

  console.log(`\n  Anomaly Alerts (${anomalies.length} total, showing ${recent.length})\n`)
  console.log(`  ${'Type'.padEnd(18)} ${'Member'.padEnd(20)} ${'Current'.padEnd(10)} ${'Baseline'.padEnd(10)} Timestamp`)
  console.log(`  ${''.padEnd(18, '-')} ${''.padEnd(20, '-')} ${''.padEnd(10, '-')} ${''.padEnd(10, '-')} ${''.padEnd(24, '-')}`)
  for (const a of recent) {
    console.log(
      `  ${a.type.padEnd(18)} ${a.member.length > 18 ? `${a.member.slice(0, 18)}\u2026` : a.member.padEnd(20)} ${String(a.current).padEnd(10)} ${String(a.baseline).padEnd(10)} ${a.timestamp}`,
    )
  }
  console.log()
}

export const command: CommandDescriptor = {
  name: 'status',
  description: 'Show project health and member metrics',
  handler: (args) => status(args),
}

export async function status(args: string[] = []): Promise<void> {
  const cwd = process.cwd()
  const flags = new Set(args.filter((a) => a.startsWith('--')))
  const isWatch = flags.has('--watch')
  const isJson = flags.has('--json')
  const isDrift = flags.has('--drift')

  if (isDrift) {
    reportDrift(cwd)
    return
  }

  if (flags.has('--learner')) {
    await printLearnerStatus(cwd, isJson)
    return
  }

  if (flags.has('--alerts')) {
    const limitIndex = args.indexOf('--limit')
    const limit = limitIndex >= 0 ? Number.parseInt(args[limitIndex + 1] ?? '20', 10) : 20
    await printAlerts(cwd, isJson, Number.isNaN(limit) || limit < 0 ? 20 : limit)
    return
  }

  const memberIndex = args.indexOf('--member')
  const member = memberIndex >= 0 ? args[memberIndex + 1] : undefined

  if (member) {
    const tracesPath = resolveTraceStorePath(cwd, loadObservabilityConfig(cwd))
    if (!existsSync(tracesPath)) {
      console.log(`\n  No traces recorded for "${member}" yet. Run \`agenthood run ${member} "<task>"\` first.\n`)
      return
    }
    const store = new JSONFileTraceStore(tracesPath)
    const windows = summarizeMemberWindows(await store.query(), member)
    printMemberWindows(member, windows, isJson)
    return
  }

  const stats = collectProjectStats(cwd)
  const allStats = collectMemberMetrics(join(cwd, '.agenthood', 'metrics'))

  const display = isJson ? printJson : printPlain

  if (isWatch) {
    runWatchLoop(cwd, stats, display)
  }

  display(stats.memberCount, stats.decisionCount, stats.lockStatus, stats.memoryInit, allStats)
}
