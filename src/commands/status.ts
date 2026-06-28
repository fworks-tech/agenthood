import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { MetricsCollector } from '../memory/MetricsCollector.js'
import { contentHash } from '../utils/hash.js'

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
}

function formatPct(rate: number | null): string {
  if (rate === null) return '—'
  return `${(rate * 100).toFixed(0)}%`
}

function printPlain(memberCount: number, decisionCount: number, lockStatus: string, memoryInit: boolean, metricsDir: string): void {
  console.log('\n  Agenthood Status\n')
  console.log(`  Members:     ${memberCount}`)
  console.log(`  Decisions:   ${decisionCount}`)
  console.log(`  Lockfile:    ${lockStatus}`)
  console.log(`  Memory:      ${memoryInit ? 'initialized' : 'not initialized'}\n`)

  const collector = new MetricsCollector(metricsDir)
  const allStats = collector.getAllStats()
  if (allStats.length > 0) {
    console.log('  Member Metrics:\n')
    console.log(`  ${'Member'.padEnd(20)} ${'Runs'.padEnd(6)} ${'Success'.padEnd(8)} ${'Avg Duration'.padEnd(14)} Last Run`)
    console.log(`  ${''.padEnd(20, '-')} ${''.padEnd(6, '-')} ${''.padEnd(8, '-')} ${''.padEnd(14, '-')} ${''.padEnd(24, '-')}`)
    for (const entry of allStats) {
      const avgDur = formatDuration(collector.getAverageDuration(entry.member) ?? 0)
      const lastRun = entry.metrics.lastRun ? new Date(entry.metrics.lastRun).toLocaleDateString() : '—'
      const successRate = formatPct(collector.getSuccessRate(entry.member))
      const name = entry.member.length > 18 ? entry.member.slice(0, 18) + '…' : entry.member
      console.log(`  ${name.padEnd(20)} ${String(entry.metrics.invocations).padEnd(6)} ${successRate.padEnd(8)} ${avgDur.padEnd(14)} ${lastRun}`)
    }
    console.log()
  }
}

function printJson(memberCount: number, decisionCount: number, lockStatus: string, memoryInit: boolean, metricsDir: string): void {
  const collector = new MetricsCollector(metricsDir)
  const output = {
    members: memberCount,
    decisions: decisionCount,
    lockfile: lockStatus,
    memory: memoryInit,
    metrics: collector.getAllStats(),
  }
  console.log(JSON.stringify(output, null, 2))
}

export async function status(args: string[] = []): Promise<void> {
  const cwd = process.cwd()
  const flags = new Set(args.filter((a) => a.startsWith('--')))
  const isWatch = flags.has('--watch')
  const isJson = flags.has('--json')
  const isDrift = flags.has('--drift')

  if (isDrift) {
    const membersDir = join(cwd, 'members')
    const lockPath = join(cwd, 'agenthood.lock')
    if (!existsSync(lockPath)) {
      console.log('\n  No lockfile found. Run `agenthood verify --update-lock` first.\n')
      process.exit(0)
      return
    }
    let lock: { members: Record<string, { version: string }> }
    try {
      lock = JSON.parse(readFileSync(lockPath, 'utf8'))
    } catch {
      console.log('\n  Invalid lockfile.\n')
      process.exit(0)
      return
    }
    const driftFound: string[] = []
    const members = readdirSync(membersDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
    for (const member of members) {
      const skillPath = join(membersDir, member, 'SKILL.md')
      if (!existsSync(skillPath)) continue
      const content = readFileSync(skillPath, 'utf8')
      const currentHash = contentHash(content)
      const lockedHash = lock.members[member]?.version
      if (lockedHash && currentHash !== lockedHash) {
        driftFound.push(member)
      }
    }
    if (driftFound.length === 0) {
      console.log('\n  No drift detected — all members match lockfile.\n')
    } else {
      console.log(`\n  Drift detected in ${driftFound.length} member(s):\n`)
      for (const m of driftFound) {
        console.log(`    ! ${m}`)
      }
      console.log()
    }
    process.exit(0)
    return
  }

  const membersDir = join(cwd, 'members')
  const memberCount = existsSync(membersDir)
    ? readdirSync(membersDir, { withFileTypes: true }).filter((d) => d.isDirectory()).length
    : 0

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

  const memoryDir = join(cwd, '.agenthood', 'memory')
  const memoryInit = existsSync(memoryDir)

  const metricsDir = join(cwd, '.agenthood', 'metrics')

  const display = isJson ? printJson : printPlain

  if (isWatch) {
    const interval = setInterval(() => {
      display(memberCount, decisionCount, lockStatus, memoryInit, metricsDir)
    }, 5000)
    display(memberCount, decisionCount, lockStatus, memoryInit, metricsDir)
    process.on('SIGINT', () => { clearInterval(interval); process.exit(0) })
    process.on('SIGTERM', () => { clearInterval(interval); process.exit(0) })
    return
  }

  display(memberCount, decisionCount, lockStatus, memoryInit, metricsDir)
}
