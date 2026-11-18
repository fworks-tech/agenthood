import { existsSync } from 'node:fs'
import type { CommandDescriptor } from './types.ts'
import { parseStoreInspectArgs } from './args.ts'
import { JSONFileTraceStore, loadObservabilityConfig, resolveTraceStorePath } from '../core/TraceStore.ts'
import { createRedactionFilterFromConfig } from '../core/RedactionFilter.ts'
import { formatDuration } from '../utils/formatDuration.ts'
import type { TraceEnvelope } from '../core/types.ts'
import { TrajectoryStore, type Trajectory } from '../core/TrajectoryStore.ts'
import { userError } from '../core/cliError.ts'

function printTable(traces: TraceEnvelope[]): void {
  const header = `${'Member'.padEnd(20)} ${'Timestamp'.padEnd(24)} ${'Duration'.padEnd(10)} ${'Cost'.padEnd(10)} ${'Quality'.padEnd(9)} Status`
  console.log(`\n  ${header}`)
  console.log(`  ${''.padEnd(20, '-')} ${''.padEnd(24, '-')} ${''.padEnd(10, '-')} ${''.padEnd(10, '-')} ${''.padEnd(9, '-')} ${''.padEnd(8, '-')}`)
  for (const t of traces) {
    const member = t.member.length > 18 ? `${t.member.slice(0, 18)}…` : t.member
    const timestamp = new Date(t.timestamp).toISOString().slice(0, 19)
    const quality = t.qualityScore === null ? '-' : t.qualityScore.toFixed(2)
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
    const called = step.tools?.map((t) => t.name) ?? (step.tool ? [step.tool] : [])
    const toolInfo = called.length > 0 ? ` → ${called.join(', ')}` : ''
    const humanInfo = step.humanDecision ? ` [${step.humanDecision}]` : ''
    console.log(`  ┌─ Step ${step.step} ─────────────────────────────────────────────────┐`)
    console.log(`  │ ${statusIcon} Model: ${step.model}${toolInfo}${humanInfo}`)
    if (step.skills?.length) console.log(`  │ Skills: ${step.skills.join(', ')}`)
    console.log(`  │ Tokens: ${step.tokens.prompt.toLocaleString()} prompt + ${step.tokens.completion.toLocaleString()} completion`)
    console.log(`  │ Cost: $${step.cost.toFixed(4)} | Duration: ${formatDuration(step.durationMs)}`)
    const toolInputs = step.tools?.map((t) => `${t.name}: ${t.input}`) ?? (step.toolInput ? [step.toolInput] : [])
    const toolOutputs = step.tools?.map((t) => t.output) ?? (step.toolOutput ? [step.toolOutput] : [])
    for (const input of toolInputs) {
      const text = input.length > 80 ? input.slice(0, 80) + '...' : input
      console.log(`  │ Input: ${text}`)
    }
    for (const output of toolOutputs) {
      const text = output.length > 80 ? output.slice(0, 80) + '...' : output
      console.log(`  │ Output: ${text}`)
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

function flagValue(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag)
  return i >= 0 ? args[i + 1] : undefined
}

function stepUsedSkill(step: Trajectory['steps'][number], skill: string): boolean {
  return step.skills?.includes(skill) === true
}

function stepUsedTool(step: Trajectory['steps'][number], tool: string): boolean {
  return step.tool === tool || step.tools?.some((t) => t.name === tool) === true
}

/** Trajectories whose steps used a skill or called a tool, newest first (#605). */
export function matchTrajectories(
  trajectories: Trajectory[],
  filter: { skill?: string; tool?: string; member?: string; since?: string; limit?: number },
): Trajectory[] {
  return trajectories
    .filter((t) => !filter.member || t.member === filter.member)
    .filter((t) => !filter.since || t.completedAt >= filter.since)
    .filter((t) => !filter.skill || t.steps.some((s) => stepUsedSkill(s, filter.skill!)))
    .filter((t) => !filter.tool || t.steps.some((s) => stepUsedTool(s, filter.tool!)))
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
    .slice(0, filter.limit)
}

function printTrajectoryList(
  trajectories: Trajectory[],
  filter: { skill?: string; tool?: string; member?: string; since?: string; limit?: number; json?: boolean },
): void {
  const matched = matchTrajectories(trajectories, filter)

  if (filter.json) {
    console.log(JSON.stringify({ trajectories: matched }, null, 2))
    return
  }
  if (matched.length === 0) {
    console.log('No trajectories match the given filters.')
    return
  }

  const header = `${'Id'.padEnd(10)} ${'Member'.padEnd(18)} ${'Steps'.padEnd(6)} ${'Cost'.padEnd(10)} Completed`
  console.log(`\n  ${header}`)
  for (const t of matched) {
    console.log(`  ${t.id.slice(0, 8).padEnd(10)} ${t.member.padEnd(18)} ${String(t.steps.length).padEnd(6)} $${t.totalCost.toFixed(4).padEnd(9)} ${t.completedAt}`)
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
  --skill <name>    List trajectories whose steps used this skill
  --activations     Activation history: which skill, in which run, when
  --tool <name>     List trajectories whose steps called this tool
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
      userError('Usage: agenthood trace visualize <trajectory-id>', { fix: 'Provide a trajectory ID to visualize.' })
    }
    const store = new TrajectoryStore(cwd)
    const t = store.load(id)
    if (!t) {
      userError(`Trajectory "${id}" not found.`, { fix: 'Run "agenthood trace list" to see available trajectories.' })
    }
    printTrajectory(t)
    return
  }

  if (args[0] === 'diff') {
    const id1 = args[1]
    const id2 = args[2]
    if (!id1 || !id2) {
      userError('Usage: agenthood trace diff <id1> <id2>', { fix: 'Provide two trajectory IDs to compare.' })
    }
    const store = new TrajectoryStore(cwd)
    const t1 = store.load(id1)
    const t2 = store.load(id2)
    if (!t1) {
      userError(`Trajectory "${id1}" not found.`, { fix: 'Run "agenthood trace list" to see available trajectories.' })
    }
    if (!t2) {
      userError(`Trajectory "${id2}" not found.`, { fix: 'Run "agenthood trace list" to see available trajectories.' })
    }
    printDiff(t1, t2)
    return
  }

  const tracesPath = resolveTraceStorePath(cwd, loadObservabilityConfig(cwd))

  const skill = flagValue(args, '--skill')
  const tool = flagValue(args, '--tool')

  const parsed = parseStoreInspectArgs(args)
  const { member, limit, since, json } = parsed
  if (parsed.help) {
    printHelp()
    return
  }

  // Activation history (#605): the skill that was active per step, across every
  // trajectory. Names and times only: the store never holds prompt content.
  if (args.includes('--activations')) {
    const entries = new TrajectoryStore(cwd)
      .list()
      .flatMap((trajectory) =>
        (trajectory.steps ?? []).flatMap((step) =>
          (step.skills ?? []).map((name) => ({
            skill: name,
            member: trajectory.member,
            trajectory: trajectory.id,
            step: step.step,
            startedAt: trajectory.startedAt,
            durationMs: step.durationMs,
          })),
        ),
      )
      .filter((entry) => (skill ? entry.skill === skill : true))
      .slice(0, limit)

    if (json) {
      console.log(JSON.stringify({ activations: entries }, null, 2))
      return
    }
    if (entries.length === 0) {
      console.log('No skill activations recorded yet. Run `agenthood run <member> "/<skill> <task>"` first.')
      return
    }
    console.log(`\n  ${'Skill'.padEnd(22)} ${'Member'.padEnd(18)} ${'Step'.padEnd(6)} ${'Duration'.padEnd(10)} Started`)
    console.log(`  ${''.padEnd(22, '-')} ${''.padEnd(18, '-')} ${''.padEnd(6, '-')} ${''.padEnd(10, '-')} ${''.padEnd(24, '-')}`)
    for (const entry of entries) {
      const name = entry.skill.length > 20 ? `${entry.skill.slice(0, 20)}…` : entry.skill
      console.log(
        `  ${name.padEnd(22)} ${entry.member.padEnd(18)} ${String(entry.step).padEnd(6)} ${`${entry.durationMs}ms`.padEnd(10)} ${entry.startedAt}`,
      )
    }
    console.log()
    return
  }


  // Skill and tool only exist on step-level trajectories, so those flags switch
  // the listing from trace envelopes to trajectories (#605).
  if (skill || tool) {
    printTrajectoryList(new TrajectoryStore(cwd).list(), { skill, tool, member, since, limit, json })
    return
  }

  if (!existsSync(tracesPath)) {
    console.log('No traces recorded yet. Run `agenthood run <member> "<task>"` first.')
    return
  }

  const store = new JSONFileTraceStore(tracesPath)
  // Logs live in the same file; drop them before the limit so a page of recent
  // logs never hides real traces.
  const result = (await store.query({ member, since })).filter((e) => e.entryType !== 'log').slice(0, limit)

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
