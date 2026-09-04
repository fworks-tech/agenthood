import { existsSync } from 'node:fs'
import type { CommandDescriptor } from './types.ts'
import { JSONFileTraceStore, loadObservabilityConfig, resolveTraceStorePath } from '../core/TraceStore.ts'
import type { LogLevel, TraceEnvelope } from '../core/types.ts'

const LOG_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error']

function isLogEnvelope(e: TraceEnvelope): boolean {
  return e.entryType === 'log' || e.level !== undefined
}

function parseLevel(value: string | undefined): LogLevel | undefined {
  const level = value?.toLowerCase() as LogLevel | undefined
  if (level === undefined) return undefined
  if (LOG_LEVELS.includes(level)) return level
  console.error(`Invalid --level value: "${value}" — use one of ${LOG_LEVELS.join(', ')}`)
  process.exit(1)
}

function resolveSince(value: string): string {
  const relative = /^(\d+)(m|h|d)$/.exec(value)
  if (relative) {
    const multiplier = relative[2] === 'm' ? 60_000 : relative[2] === 'h' ? 3_600_000 : 86_400_000
    return new Date(Date.now() - Number(relative[1]) * multiplier).toISOString()
  }
  const ts = Date.parse(value)
  if (Number.isNaN(ts)) {
    console.error(`Invalid --since value: "${value}" — use an ISO date or 1h/24h/7d`)
    process.exit(1)
    return ''
  }
  return new Date(ts).toISOString()
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
  let member: string | undefined
  let limit = 20
  let since: string | undefined
  let json = false

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    switch (arg) {
      case '--level':
        level = parseLevel(args[++i])
        break
      case '--member':
        member = args[++i]
        break
      case '--limit': {
        const parsed = Number.parseInt(args[++i] ?? '', 10)
        if (Number.isNaN(parsed) || parsed < 0) {
          console.error('Invalid --limit value — expected a non-negative integer')
          process.exit(1)
        }
        limit = parsed
        break
      }
      case '--since':
        since = resolveSince(args[++i] ?? '')
        break
      case '--json':
        json = true
        break
      case '--help':
      case '-h':
        printHelp()
        return
      default:
        break
    }
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
    console.log(JSON.stringify({ entries: result }, null, 2))
    return
  }

  if (result.length === 0) {
    console.log('No log entries match the given filters.')
    return
  }

  printTable(result)
}