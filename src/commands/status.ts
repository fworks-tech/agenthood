import { existsSync, readFileSync, readdirSync } from 'node:fs'
import type { CommandDescriptor } from './types.js'
import { join } from 'node:path'
import type { MetricsEntry } from '../memory/MetricsCollector.js'
import { collectMemberMetrics } from './collectMetrics.js'
import { contentHash } from '../utils/hash.js'
import { loadLockfile } from '../utils/lockfile.js'
import { resolveSkillsDir } from '../members.js'
import { JSONFileTraceStore } from '../core/TraceStore.js'
import { summarizeMemberWindows } from '../core/traceSummary.js'
import type { TraceWindow } from '../core/traceSummary.js'

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
}

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

  const memberIndex = args.indexOf('--member')
  const member = memberIndex >= 0 ? args[memberIndex + 1] : undefined

  if (member) {
    const tracesPath = join(cwd, '.agenthood', 'traces', 'traces.ndjson')
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
