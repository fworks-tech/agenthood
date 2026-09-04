import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { createRedactionFilterFromConfig, RedactionFilter } from '../core/RedactionFilter.ts'
import { JSONFileTraceStore, loadObservabilityConfig } from '../core/TraceStore.ts'
import { ReplayEvaluator } from '../evals/ReplayEvaluator.ts'
import type { EmbedFn, ReplayReport } from '../evals/ReplayEvaluator.ts'
import { ApplicationContext } from '../runtime/ApplicationContext.ts'
import { loadConfigOrExit } from './config.ts'

function printReplaySummary(report: ReplayReport): void {
  console.log(`\n  Replay Report — ${report.members.join(', ') || 'unknown member'}`)
  console.log(`  Traces: ${report.replayCount} | Skipped: ${report.skippedCount} | Errors: ${report.errorCount} | Avg similarity: ${report.averageSimilarity ?? '—'}`)
  console.log(`  Report saved: .agenthood/evals/replay-report.json\n`)
}

/**
 * Re-runs the member against stored trace inputs and reports output drift.
 * Re-run outputs are passed through the redactor before persisting/printing.
 */
export async function runReplay(member: string, limit: number, json: boolean): Promise<void> {
  const cwd = process.cwd()
  const tracesPath = join(cwd, '.agenthood', 'traces', 'traces.ndjson')
  if (!existsSync(tracesPath)) {
    console.error('No traces recorded yet. Run `agenthood run <member> "<task>"` first.')
    process.exit(1)
  }

  let envelopes = (await new JSONFileTraceStore(tracesPath).query()).filter((e) => e.entryType !== 'log')
  envelopes = envelopes.filter((e) => e.member === member).slice(-limit)
  if (envelopes.length === 0) {
    console.error(`No traces for member "${member}".`)
    process.exit(1)
  }

  const config = await loadConfigOrExit()
  const app = await ApplicationContext.create(cwd, config)
  app.ctx.source = 'automated'
  if (!app.members.has(member)) {
    console.error(`Unknown member: "${member}"`)
    process.exit(1)
  }

  const runner = (task: string) => app.runner.runMemberTask(member, task, config)
  const embed: EmbedFn = (text) => app.llm.embed(text)
  const report = await new ReplayEvaluator(runner, embed).replay(envelopes)

  const redactor = createRedactionFilterFromConfig(loadObservabilityConfig(cwd)) ?? new RedactionFilter()
  for (const task of report.tasks) {
    if (task.newOutput !== undefined) task.newOutput = redactor.redactText(task.newOutput)
  }

  const reportPath = join(cwd, '.agenthood', 'evals', 'replay-report.json')
  mkdirSync(dirname(reportPath), { recursive: true })
  writeFileSync(reportPath, JSON.stringify(report, null, 2), { mode: 0o600 })

  if (json) {
    console.log(JSON.stringify(report, null, 2))
    return
  }
  printReplaySummary(report)
}
