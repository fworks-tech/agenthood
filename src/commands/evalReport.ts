import { RunHistory } from '../evals/runHistory.ts'
import { detectConvergence, detectRegression } from '../evals/convergence.ts'
import type { EvalReport } from '../evals/EvalRunner.ts'
import type { RegressionReport } from '../evals/BaselineComparator.ts'

const METRIC_LABELS: Record<string, string> = {
  faithfulness: 'Faith',
  relevance: 'Relv.',
  context_recall: 'CtxR.',
  answer_correctness: 'Corr.',
  assertions: 'Assert',
}

export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}\u2026` : text
}

export function printScoreTable(tasks: EvalReport['tasks'], labels: string[]): void {
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

export function printReport(report: EvalReport, comparison: RegressionReport | null, baselinePath: string | null): void {
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

export function printConvergence(member: string, suiteName: string): void {
  const history = new RunHistory(member).loadForSuite(suiteName)
  const convergence = detectConvergence(history)
  const regression = detectRegression(history)

  const status = convergence.converged ? 'YES' : 'no'
  const pct = (convergence.meanPassRate * 100).toFixed(1)
  console.log(`\n  Convergence: ${status} | runs: ${convergence.runsObserved} | variance: ${convergence.variance.toFixed(4)} | mean pass rate: ${pct}%`)

  if (regression.isRegression) {
    console.log(`  Regression: pass rate dropped ${(regression.delta * 100).toFixed(1)}pp (best ${(regression.bestPassRate * 100).toFixed(1)}% → current ${(regression.currentPassRate * 100).toFixed(1)}%)`)
  }
  console.log()
}

export function printHistory(member: string): void {
  const history = new RunHistory(member).load()
  if (history.length === 0) {
    console.log(`\n  No eval history for "${member}".\n`)
    return
  }
  console.log(`\n  Eval History — ${member} (${history.length} runs)\n`)
  const header = ['Timestamp', 'Suite', 'Pass Rate', 'Tasks', 'Duration']
  const widths = [24, 30, 11, 6, 10]
  console.log(`  ${header.map((h, i) => h.padEnd(widths[i])).join(' ')}`)
  console.log(`  ${widths.map((w) => ''.padEnd(w, '-')).join(' ')}`)

  for (const run of history) {
    const ts = run.timestamp.slice(0, 19).replace('T', ' ')
    const suite = truncate(run.suiteName, widths[1]).padEnd(widths[1])
    const pass = run.passRate < 0 ? 'n/a' : `${(run.passRate * 100).toFixed(1)}%`
    const tasks = String(run.taskCount).padEnd(widths[3])
    const dur = `${(run.durationMs / 1000).toFixed(1)}s`.padEnd(widths[4])
    console.log(`  ${ts.padEnd(widths[0])} ${suite} ${pass.padEnd(widths[2])} ${tasks} ${dur}`)
  }
  console.log()
}

export function printProviderComparison(benchmarks: { provider?: string; model?: string; passRate: number | null; avgTimeMs: number | null; avgTokens: number | null }[]): void {
  const header = ['Provider', 'Model', 'Pass Rate', 'Avg Time', 'Avg Tokens']
  const widths = [16, 24, 11, 10, 11]
  console.log(`\n  Provider Comparison\n`)
  console.log(`  ${header.map((h, i) => h.padEnd(widths[i])).join(' ')}`)
  console.log(`  ${widths.map((w) => ''.padEnd(w, '-')).join(' ')}`)
  for (const b of benchmarks) {
    const pass = b.passRate === null ? 'n/a' : `${(b.passRate * 100).toFixed(1)}%`
    const time = `${b.avgTimeMs ?? 0}ms`.padEnd(widths[3])
    const tokens = String(b.avgTokens ?? 0).padEnd(widths[4])
    console.log(`  ${(b.provider ?? 'default').padEnd(widths[0])} ${(b.model ?? '').slice(0, widths[1] - 1).padEnd(widths[1])} ${pass.padEnd(widths[2])} ${time} ${tokens}`)
  }
  console.log()
}
