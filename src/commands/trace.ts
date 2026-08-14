import { existsSync } from 'node:fs'
import type { CommandDescriptor } from './types.js'
import { JSONFileTraceStore, loadObservabilityConfig, resolveTraceStorePath } from '../core/TraceStore.js'
import { formatDuration } from '../utils/formatDuration.js'
import type { TraceEnvelope } from '../core/types.js'

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

function printTable(traces: TraceEnvelope[]): void {
  const header = `${'Member'.padEnd(20)} ${'Timestamp'.padEnd(24)} ${'Duration'.padEnd(10)} ${'Cost'.padEnd(10)} ${'Quality'.padEnd(9)} Status`
  console.log(`\n  ${header}`)
  console.log(`  ${''.padEnd(20, '-')} ${''.padEnd(24, '-')} ${''.padEnd(10, '-')} ${''.padEnd(10, '-')} ${''.padEnd(9, '-')} ${''.padEnd(8, '-')}`)
  for (const t of traces) {
    const member = t.member.length > 18 ? `${t.member.slice(0, 18)}…` : t.member
    const timestamp = new Date(t.timestamp).toISOString().slice(0, 19)
    const quality = t.qualityScore === null ? '—' : t.qualityScore.toFixed(2)
    console.log(`  ${member.padEnd(20)} ${timestamp.padEnd(24)} ${formatDuration(t.durationMs).padEnd(10)} $${t.cost.toFixed(4).padEnd(9)} ${quality.padEnd(9)} ${t.status}`)
  }
  console.log()
}

function printHelp(): void {
  console.log(`Usage:
  npx agenthood trace [options]

Inspect recent member invocation traces from the observability store.

Options:
  --member <name>   Filter by member name
  --limit <n>       Maximum number of traces (default 20)
  --since <time>    Only traces newer than <time> (ISO date or 1h/24h/7d)
  --json            Machine-readable JSON output
  --help            Show this help
`)
}

export const command: CommandDescriptor = {
  name: 'trace',
  description: 'List recent member invocation traces',
  handler: (args) => trace(args),
}

export async function trace(args: string[] = []): Promise<void> {
  const cwd = process.cwd()
  const tracesPath = resolveTraceStorePath(cwd, loadObservabilityConfig(cwd))

  let member: string | undefined
  let limit = 20
  let since: string | undefined
  let json = false

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    switch (arg) {
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
    console.log('No traces recorded yet. Run `agenthood run <member> "<task>"` first.')
    return
  }

  const store = new JSONFileTraceStore(tracesPath)
  const result = await store.query({ member, since, limit })

  if (json) {
    console.log(JSON.stringify({ traces: result }, null, 2))
    return
  }

  if (result.length === 0) {
    console.log('No traces match the given filters.')
    return
  }

  printTable(result)
}
