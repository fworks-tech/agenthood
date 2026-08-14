import { join } from 'node:path'

import { SchemaValidationError } from '../core/SchemaValidator.js'
import { loadEvalSuite } from '../evals/evalSuiteSchema.js'
import { LLMJudge } from '../evals/EvalJudge.js'
import { EvalRunner } from '../evals/EvalRunner.js'
import type { EvalReport } from '../evals/EvalRunner.js'
import { BaselineComparator } from '../evals/BaselineComparator.js'
import type { RegressionReport } from '../evals/BaselineComparator.js'
import { ApplicationContext } from '../runtime/ApplicationContext.ts'
import { loadConfig } from './run.js'
import type { CommandDescriptor } from './types.js'
import type { EvalSuite } from '../evals/types.js'

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
  --json                Machine-readable JSON output
  --help                Show this help`)
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}\u2026` : text
}

function printReport(report: EvalReport, comparison: RegressionReport | null, baselinePath: string | null): void {
  console.log(`\n  Eval Report — ${report.member} (${report.suiteName})`)
  console.log(`  Suite: ${report.suiteName} | Tasks: ${report.tasks.length} | Timestamp: ${report.timestamp}\n`)

  const labels = Object.keys(report.aggregate)
  const header = ['Task', ...labels.map((m) => METRIC_LABELS[m] ?? m), 'Status']
  const widths = [40, ...labels.map((m) => Math.max(METRIC_LABELS[m]?.length ?? m.length, 7)), 12]
  console.log(`  ${header.map((h, i) => h.padEnd(widths[i])).join(' ')}`)
  console.log(`  ${widths.map((w) => ''.padEnd(w, '-')).join(' ')}`)

  for (const task of report.tasks) {
    const row = [truncate(task.input, widths[0]).padEnd(widths[0])]
    for (const metric of labels) {
      const score = task.scores[metric]
      row.push((score === undefined ? '\u2014' : score.toFixed(2)).padEnd(widths[row.length]))
    }
    row.push(task.status.padEnd(widths[widths.length - 1]))
    console.log(`  ${row.join(' ')}`)
  }

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

export async function evalMember(args: string[] = []): Promise<void> {
  const positional: string[] = []
  let suitePath: string | undefined
  let baselinePath: string | undefined
  let updateBaseline = false
  let json = false

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--suite':
        suitePath = args[++i]
        break
      case '--baseline':
        baselinePath = args[++i]
        break
      case '--update-baseline':
        updateBaseline = true
        break
      case '--json':
        json = true
        break
      case '--help':
      case '-h':
        printUsage()
        return
      default:
        positional.push(args[i])
    }
  }

  const member = positional[0]
  if (!member || !suitePath) {
    printUsage()
    process.exit(1)
  }

  let suite: EvalSuite
  try {
    suite = loadEvalSuite(suitePath)
  } catch (err) {
    if (err instanceof SchemaValidationError) {
      console.error(`Invalid eval suite: ${err.message}`)
      process.exit(2)
    }
    throw err
  }

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
