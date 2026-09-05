import { existsSync } from 'node:fs'
import type { CommandDescriptor } from './types.ts'
import { parseStoreInspectArgs } from './args.ts'
import { JSONFileTraceStore, loadObservabilityConfig, resolveTraceStorePath } from '../core/TraceStore.ts'
import { createRedactionFilterFromConfig } from '../core/RedactionFilter.ts'
import { formatDuration } from '../utils/formatDuration.ts'
import type { TraceEnvelope } from '../core/types.ts'
import { TrajectoryStore, type Trajectory, type TrajectoryStep } from '../core/TrajectoryStore.ts'

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

function printTrajectory(t: Trajectory): void {
  console.log(`\n  Trajectory: ${t.id}`)
  console.log(`  Member: ${t.member}`)
  console.log(`  Task: ${t.task}`)
  console.log(`  Started: ${t.startedAt}`)
  console.log(`  Completed: ${t.completedAt}`)
  console.log(`  Total: ${t.steps.length} steps, ${t.totalTokens.toLocaleString()} tokens, $${t.totalCost.toFixed(4)}, ${formatDuration(t.totalDurationMs)}`)
  console.log()

  for (const step of t.steps) {
    const statusIcon = step.status === 'success' ? '✓' : step.status === 'error' ? '✗' : step.status === 'human-input' ? '◉' : '↻'
    const toolInfo = step.tool ? ` → ${step.tool}` : ''
    const humanInfo = step.humanDecision ? ` [${step.humanDecision}]` : ''
    console.log(`  ┌─ Step ${step.step} ─────────────────────────────────────────────────┐`)
    console.log(`  │ ${statusIcon} Model: ${step.model}${toolInfo}${humanInfo}`)
    console.log(`  │ Tokens: ${step.tokens.prompt.toLocaleString()} prompt + ${step.tokens.completion.toLocaleString()} completion`)
    console.log(`  │ Cost: $${step.cost.toFixed(4)} | Duration: ${formatDuration(step.durationMs)}`)
    if (step.toolInput) {
      const input = step.toolInput.length > 80 ? step.toolInput.slice(0, 80) + '...' : step.toolInput
      console.log(`  │ Input: ${input}`)
    }
    if (step.toolOutput) {
      const output = step.toolOutput.length > 80 ? step.toolOutput.slice(0, 80) + '...' : step.toolOutput
      console.log(`  │ Output: ${output}`)
    }
    console.log(`  └──────────────────────────────────────────────────────────────┘`)
  }
  console.log()
}

function printDiff(t1: Trajectory, t2: Trajectory): void {
  console.log(`\n  Comparing trajectories:`)
  console.log(`  ${t1.id.slice(0, 8)} (${t1.member}) vs ${t2.id.slice(0, 8)} (${t2.member})`)
  console.log()

  const rows = [
    ['Steps', t1.steps.length.toString(), t2.steps.length.toString()],
    ['Tokens', t1.totalTokens.toLocaleString(), t2.totalTokens.toLocaleString()],
    ['Cost', `$${t1.totalCost.toFixed(4)}`, `$${t2.totalCost.toFixed(4)}`],
    ['Duration', formatDuration(t1.totalDurationMs), formatDuration(t2.totalDurationMs)],
  ]

  const header = `${'Metric'.padEnd(12)} ${t1.id.slice(0, 8).padEnd(12)} ${t2.id.slice(0, 8).padEnd(12)} Delta`
  console.log(`  ${header}`)
  console.log(`  ${''.padEnd(12, '-')} ${''.padEnd(12, '-')} ${''.padEnd(12, '-')} ${''.padEnd(8, '-')}`)
  for (const [metric, v1, v2] of rows) {
    console.log(`  ${metric.padEnd(12)} ${v1.padEnd(12)} ${v2.padEnd(12)} `)
  }
  console.log()
}

function printHelp(): void {
  console.log(`Usage:
  npx agenthood trace [options]
  npx agenthood trace visualize <id>
  npx agenthood trace diff <id1> <id2>

Inspect recent member invocation traces from the observability store.

Options:
  --member <name>   Filter by member name
  --limit <n>       Maximum number of traces (default 20)
  --since <time>    Only traces newer than <time> (ISO date or 1h/24h/7d)
  --json            Machine-readable JSON output
  --help            Show this help

Subcommands:
  visualize <id>    Show ASCII timeline of a trajectory
  diff <id1> <id2>  Compare two trajectories side-by-side
`)
}

export const command: CommandDescriptor = {
  name: 'trace',
  aliases: ['traces'],
  description: 'List recent member invocation traces',
  handler: (args) => trace(args),
}

export async function trace(args: string[] = []): Promise<void> {
  const cwd = process.cwd()

  // Subcommand routing
  if (args[0] === 'visualize' || args[0] === 'viz') {
    const id = args[1]
    if (!id) {
      console.error('Usage: agenthood trace visualize <trajectory-id>')
      process.exit(1)
    }
    const store = new TrajectoryStore(cwd)
    const t = store.load(id)
    if (!t) {
      console.error(`Trajectory "${id}" not found.`)
      process.exit(1)
    }
    printTrajectory(t)
    return
  }

  if (args[0] === 'diff') {
    const id1 = args[1]
    const id2 = args[2]
    if (!id1 || !id2) {
      console.error('Usage: agenthood trace diff <id1> <id2>')
      process.exit(1)
    }
    const store = new TrajectoryStore(cwd)
    const t1 = store.load(id1)
    const t2 = store.load(id2)
    if (!t1) {
      console.error(`Trajectory "${id1}" not found.`)
      process.exit(1)
    }
    if (!t2) {
      console.error(`Trajectory "${id2}" not found.`)
      process.exit(1)
    }
    printDiff(t1, t2)
    return
  }

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
