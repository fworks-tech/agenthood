import { existsSync } from 'node:fs'
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
  --since <time>    Only entries newer than <time> (ISO date or 1h/24h/7d)
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
  const parsed = parseStoreInspectArgs(args, (flag, value) => {
    if (flag === '--level') {
      level = parseLevel(value)
      return true
    }
    return false
  })
  const { member, limit, since, json } = parsed
  if (parsed.help) {
    printHelp()
    return
  }

  if (!existsSync(tracesPath)) {
    console.log('No log entries recorded yet.')
    return
  }

  const store = new JSONFileTraceStore(tracesPath)
  let result = (await store.query({ member, since })).filter(isLogEnvelope)
  if (level) result = result.filter((e) => e.level === level)
  result = result.slice(0, limit)

  if (json) {
    const redactor = createRedactionFilterFromConfig(loadObservabilityConfig(cwd))
    const sanitized = result.map((e) => (redactor ? redactor.redact(e) : e))
    console.log(JSON.stringify({ entries: sanitized }, null, 2))
    return
  }

  if (result.length === 0) {
    console.log('No log entries match the given filters.')
    return
  }

  printTable(result)
}