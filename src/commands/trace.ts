import { existsSync } from 'node:fs'
import type { CommandDescriptor } from './types.ts'
import { parseStoreInspectArgs } from './args.ts'
import { JSONFileTraceStore, loadObservabilityConfig, resolveTraceStorePath } from '../core/TraceStore.ts'
import { createRedactionFilterFromConfig } from '../core/RedactionFilter.ts'
import { formatDuration } from '../utils/formatDuration.ts'
import type { TraceEnvelope } from '../core/types.ts'

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

  const parsed = parseStoreInspectArgs(args)
  const { member, limit, since, json } = parsed
  if (parsed.help) {
    printHelp()
    return
  }

  if (!existsSync(tracesPath)) {
    console.log('No traces recorded yet. Run `agenthood run <member> "<task>"` first.')
    return
  }

  const store = new JSONFileTraceStore(tracesPath)
  const result = (await store.query({ member, since, limit })).filter((e) => e.entryType !== 'log')

  if (json) {
    const redactor = createRedactionFilterFromConfig(loadObservabilityConfig(cwd))
    const sanitized = result.map((e) => (redactor ? redactor.redact(e) : e))
    console.log(JSON.stringify({ traces: sanitized }, null, 2))
    return
  }

  if (result.length === 0) {
    console.log('No traces match the given filters.')
    return
  }

  printTable(result)
}
