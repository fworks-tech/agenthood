import { existsSync, watch as fsWatch } from 'node:fs'
import type { CommandDescriptor } from './types.ts'
import { parseStoreInspectArgs } from './args.ts'
import { JSONFileTraceStore, loadObservabilityConfig, resolveTraceStorePath } from '../core/TraceStore.ts'
import { createRedactionFilterFromConfig } from '../core/RedactionFilter.ts'
import type { LogLevel, TraceEnvelope } from '../core/types.ts'

const LOG_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error']

function isLogEnvelope(e: TraceEnvelope): boolean {
  return e.entryType === 'log'
}

function parseLevel(value: string | undefined): LogLevel | undefined {
  const level = value?.toLowerCase() as LogLevel | undefined
  if (level === undefined) return undefined
  if (LOG_LEVELS.includes(level)) return level
  console.error(`Invalid --level value: "${value}" — use one of ${LOG_LEVELS.join(', ')}`)
  process.exit(1)
}

function printTable(logs: TraceEnvelope[]): void {
  const header = `${'Level'.padEnd(7)} ${'Timestamp'.padEnd(24)} ${'Member'.padEnd(20)} Message`
  console.log(`\n  ${header}`)
  console.log(`  ${''.padEnd(7, '-')} ${''.padEnd(24, '-')} ${''.padEnd(20, '-')} ${''.padEnd(8, '-')}`)
  for (const l of logs) {
    const member = l.member.length > 18 ? `${l.member.slice(0, 18)}…` : l.member
    const timestamp = new Date(l.timestamp).toISOString().slice(0, 19)
    console.log(`  ${(l.level ?? 'info').toUpperCase().padEnd(7)} ${timestamp.padEnd(24)} ${member.padEnd(20)} ${l.message ?? ''}`)
  }
  console.log()
}

function printHelp(): void {
  console.log(`Usage:
  npx agenthood log [options]

Inspect recent log entries from the observability store.

Options:
  --level <level>   Filter by level: debug, info, warn, error
  --member <name>   Filter by member name
  --limit <n>       Maximum number of entries (default 20)
  --tail <n>        Show last N entries (overrides --limit)
  --since <time>    Only entries newer than <time> (ISO date or 1h/24h/7d)
  --follow, -f      Stream new entries as they appear
  --json            Machine-readable JSON output
  --help            Show this help
`)
}

export const command: CommandDescriptor = {
  name: 'log',
  description: 'List recent log entries',
  handler: (args) => log(args),
}

export async function log(args: string[] = []): Promise<void> {
  const cwd = process.cwd()
  const tracesPath = resolveTraceStorePath(cwd, loadObservabilityConfig(cwd))

  let level: LogLevel | undefined
  let tail: number | undefined
  let follow = false
  const parsed = parseStoreInspectArgs(args, (flag, value) => {
    if (flag === '--level') {
      level = parseLevel(value)
      return true
    }
    if (flag === '--tail') {
      tail = Number.parseInt(value ?? '', 10)
      if (Number.isNaN(tail) || tail < 0) {
        console.error('Invalid --tail value — expected a non-negative integer')
        process.exit(1)
      }
      return true
    }
    if (flag === '--follow' || flag === '-f') {
      follow = true
      return false
    }
    return false
  })
  const { member, since, json } = parsed
  const limit = tail ?? parsed.limit
  if (parsed.help) {
    printHelp()
    return
  }

  if (!existsSync(tracesPath)) {
    console.log('No log entries recorded yet.')
    return
  }

  const store = new JSONFileTraceStore(tracesPath)

  async function fetchAndPrint(): Promise<TraceEnvelope[]> {
    let result = (await store.query({ member, since })).filter(isLogEnvelope)
    if (level) result = result.filter((e) => e.level === level)
    result = result.slice(0, limit)
    if (json) {
      const redactor = createRedactionFilterFromConfig(loadObservabilityConfig(cwd))
      const sanitized = result.map((e) => (redactor ? redactor.redact(e) : e))
      console.log(JSON.stringify({ entries: sanitized }, null, 2))
    } else if (result.length > 0) {
      printTable(result)
    }
    return result
  }

  const shown = await fetchAndPrint()

  if (!follow) {
    if (shown.length === 0) {
      console.log('No log entries match the given filters.')
    }
    return
  }

  // --follow mode: watch for new entries
  console.log('  Following log entries (Ctrl+C to stop)...\n')
  let lastTimestamp = shown.length > 0 ? shown[0].timestamp : new Date().toISOString()

  const watcher = fsWatch(tracesPath, async () => {
    try {
      const all = (await store.query({ member, since: lastTimestamp })).filter(isLogEnvelope)
      let newEntries = level ? all.filter((e) => e.level === level) : all
      newEntries = newEntries.filter((e) => e.timestamp > lastTimestamp)
      if (newEntries.length > 0) {
        lastTimestamp = newEntries[newEntries.length - 1].timestamp
        printTable(newEntries)
      }
    } catch {
      // file may be mid-write
    }
  })

  process.on('SIGINT', () => {
    watcher.close()
    process.exit(0)
  })
}