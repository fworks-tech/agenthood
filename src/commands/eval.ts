import { join } from 'node:path'

import { SchemaValidationError } from '../core/SchemaValidator.ts'
import { loadEvalSuite } from '../evals/evalSuiteSchema.ts'
import { LLMJudge } from '../evals/EvalJudge.ts'
import { EvalRunner } from '../evals/EvalRunner.ts'
import type { EvalReport } from '../evals/EvalRunner.ts'
import { BaselineComparator } from '../evals/BaselineComparator.ts'
import type { RegressionReport } from '../evals/BaselineComparator.ts'
import { ApplicationContext } from '../runtime/ApplicationContext.ts'
import { loadConfig } from './config.ts'
import { runReplay } from './evalReplay.ts'
import type { CommandDescriptor } from './types.ts'
import type { EvalSuite } from '../evals/types.ts'

const METRIC_LABELS: Record<string, string> = {
  faithfulness: 'Faith',
  relevance: 'Relv.',
  context_recall: 'CtxR.',
  answer_correctness: 'Corr.',
}

function printUsage(): void {
  console.error(`Usage: agenthood eval <member> --suite <path>
  --suite <path>        Eval suite file (see evals/benchmarks/)
  --baseline <path>     Baseline file (default .agenthood/baselines/<member>.json)
  --update-baseline     Store this run as the new baseline
  --replay [--limit N]  Re-run stored traces and compare output drift (no suite)
  --json                Machine-readable JSON output
  --help                Show this help`)
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}\u2026` : text
}

function printScoreTable(tasks: EvalReport['tasks'], labels: string[]): void {
  const header = ['Task', ...labels.map((m) => METRIC_LABELS[m] ?? m), 'Status']
  const widths = [40, ...labels.map((m) => Math.max(METRIC_LABELS[m]?.length ?? m.length, 7)), 12]
  console.log(`  ${header.map((h, i) => h.padEnd(widths[i])).join(' ')}`)
  console.log(`  ${widths.map((w) => ''.padEnd(w, '-')).join(' ')}`)

  for (const task of tasks) {
    const row = [truncate(task.input, widths[0]).padEnd(widths[0])]
    for (const metric of labels) {
      const score = task.scores[metric]
      row.push((score === undefined ? '\u2014' : score.toFixed(2)).padEnd(widths[row.length]))
    }
    row.push(task.status.padEnd(widths[widths.length - 1]))
    console.log(`  ${row.join(' ')}`)
  }
}

function printReport(report: EvalReport, comparison: RegressionReport | null, baselinePath: string | null): void {
  console.log(`\n  Eval Report — ${report.member} (${report.suiteName})`)
  console.log(`  Suite: ${report.suiteName} | Tasks: ${report.tasks.length} | Timestamp: ${report.timestamp}\n`)

  printScoreTable(report.tasks, Object.keys(report.aggregate))

  const aggregate = Object.entries(report.aggregate)
    .map(([m, v]) => `${m} ${v.toFixed(2)}`)
    .join(', ')
  console.log(`\n  Aggregate: ${aggregate || 'no scores'}\n`)

  if (comparison) {
    for (const r of comparison.regressions) {
      console.log(`  Regression: ${r.metric} ${r.baseline.toFixed(2)} \u2192 ${r.current.toFixed(2)} (${r.delta >= 0 ? '+' : ''}${r.delta.toFixed(2)})`)
    }
    for (const r of comparison.improvements) {
      console.log(`  Improvement: ${r.metric} ${r.baseline.toFixed(2)} \u2192 ${r.current.toFixed(2)} (${r.delta >= 0 ? '+' : ''}${r.delta.toFixed(2)})`)
    }
    if (comparison.missingMetrics.length > 0) {
      console.log(`  Missing metrics: ${comparison.missingMetrics.join(', ')}`)
    }
    if (comparison.overall === 'flag') {
      console.log(`\n  Result: FLAG — ${comparison.regressions.length} regression(s)\n`)
    } else {
      console.log('\n  Result: PASS\n')
    }
  } else if (baselinePath) {
    console.log(`  No baseline at ${baselinePath} — run with --update-baseline to create one.`)
  }
}

export const command: CommandDescriptor = {
  name: 'eval',
  description: 'Run an eval suite against a member and compare against baseline',
  handler: (args) => evalMember(args),
}

interface ParsedEvalArgs {
  member: string | undefined
  suitePath: string | undefined
  baselinePath: string | undefined
  shouldUpdateBaseline: boolean
  shouldJson: boolean
  shouldReplay: boolean
  replayLimit: number
  helpRequested: boolean
}

const BOOLEAN_FLAGS: Record<string, 'shouldUpdateBaseline' | 'shouldJson' | 'shouldReplay'> = {
  '--json': 'shouldJson',
  '--replay': 'shouldReplay',
  '--update-baseline': 'shouldUpdateBaseline',
}

function failUsage(message: string): never {
  console.error(message)
  process.exit(1)
}

export function parseEvalArgs(args: string[]): ParsedEvalArgs {
  const positional: string[] = []
  const flags: ParsedEvalArgs = {
    member: undefined, suitePath: undefined, baselinePath: undefined,
    shouldUpdateBaseline: false, shouldJson: false, shouldReplay: false, replayLimit: 50, helpRequested: false,
  }

  for (let i = 0; i < args.length; i++) {
    const booleanFlag = BOOLEAN_FLAGS[args[i]]
    if (booleanFlag) {
      flags[booleanFlag] = true
      continue
    }
    switch (args[i]) {
      case '--suite':
        flags.suitePath = args[++i]
        break
      case '--baseline':
        flags.baselinePath = args[++i]
        break
      case '--limit':
        flags.replayLimit = parseReplayLimit(args[++i])
        break
      case '--help':
      case '-h':
        printUsage()
        return { ...flags, helpRequested: true }
      default:
        positional.push(args[i])
    }
  }

  return { ...flags, member: positional[0] }
}

export function parseReplayLimit(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? '', 10)
  // 0 would disable the limit (slice(-0) === slice(0), unbounded replay)
  if (Number.isNaN(parsed) || parsed <= 0) {
    failUsage('Invalid --limit value — expected a positive integer')
  }
  return parsed
}

export async function evalMember(args: string[] = []): Promise<void> {
  const { member, suitePath, baselinePath, shouldUpdateBaseline, shouldJson, shouldReplay, replayLimit, helpRequested } = parseEvalArgs(args)
  if (helpRequested) return

  if (shouldReplay) {
    if (!member) {
      printUsage()
      process.exit(1)
    }
    await runReplay(member, replayLimit, shouldJson)
    return
  }
  if (!member || !suitePath) {
    printUsage()
    process.exit(1)
  }

  const suite = loadSuiteOrExit(suitePath)

  const config = await loadConfig()
  const app = await ApplicationContext.create(process.cwd(), config)
  app.ctx.source = 'automated'

  if (!app.members.has(member)) {
    console.error(`Unknown member: "${member}"`)
    process.exit(1)
  }

  const runner = (task: string) => app.runMemberTask(member, task, config)
  const judge = new LLMJudge(app.llm)
  const report = await new EvalRunner(runner, judge).run(suite, member)

  await finishWithBaseline(report, member, baselinePath, shouldUpdateBaseline, shouldJson)
}

function loadSuiteOrExit(suitePath: string): EvalSuite {
  try {
    return loadEvalSuite(suitePath)
  } catch (err) {
    if (err instanceof SchemaValidationError) {
      console.error(`Invalid eval suite: ${err.message}`)
      process.exit(2)
    }
    throw err
  }
}

async function finishWithBaseline(
  report: EvalReport,
  member: string,
  baselinePath: string | undefined,
  updateBaseline: boolean,
  json: boolean,
): Promise<void> {
  const baselineFile = baselinePath ?? join(process.cwd(), '.agenthood', 'baselines', `${member}.json`)
  const comparator = new BaselineComparator()

  if (updateBaseline) {
    comparator.saveBaseline(report, baselineFile)
    if (json) {
      console.log(JSON.stringify({ report, baseline: baselineFile, updated: true }, null, 2))
    } else {
      console.log(`\n  Baseline saved: ${baselineFile}\n`)
    }
    return
  }

  const baseline = comparator.loadBaseline(baselineFile)
  const comparison = baseline ? comparator.compare(report, baseline) : null

  if (json) {
    console.log(JSON.stringify({ report, baseline: baselineFile, comparison }, null, 2))
  } else {
    printReport(report, comparison, baselineFile)
  }

  if (comparison?.overall === 'flag') process.exit(1)
}

