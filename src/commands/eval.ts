import { join, dirname } from 'node:path'
import { writeFileSync, mkdirSync } from 'node:fs'

import { SchemaValidationError } from '../core/SchemaValidator.ts'
import { loadEvalSuite } from '../evals/evalSuiteSchema.ts'
import { buildBenchmark, taskPassed } from '../evals/benchmark.ts'
import { LLMJudge } from '../evals/EvalJudge.ts'
import { EvalRunner } from '../evals/EvalRunner.ts'
import type { EvalReport } from '../evals/EvalRunner.ts'
import { BaselineComparator } from '../evals/BaselineComparator.ts'
import { RunHistory } from '../evals/runHistory.ts'
import { runABComparison } from './evalCompare.ts'
import { printReport, printConvergence, printHistory, printProviderComparison } from './evalReport.ts'
import type { EvalRunRecord } from '../evals/types.ts'
import { ApplicationContext } from '../runtime/ApplicationContext.ts'
import { loadTriggerSet, runTriggerRate } from './evalTriggers.ts'
import { loadConfigOrExit } from './config.ts'
import { runReplay } from './evalReplay.ts'
import type { CommandDescriptor } from './types.ts'
import { parseEvalArgs, printUsage, type ParsedEvalArgs } from './evalArgs.ts'
import type { EvalSuite } from '../evals/types.ts'
import type { LLMConfig } from '../llm/types.ts'
import type { EmbedFn } from '../evals/ReplayEvaluator.ts'






export const command: CommandDescriptor = {
  name: 'eval',
  description: 'Run an eval suite against a member and compare against baseline',
  handler: (args) => evalMember(args),
}






export async function evalMember(args: string[] = []): Promise<void> {
  const flags = parseEvalArgs(args)
  if (flags.helpRequested) return

  if (flags.triggersPath) {
    await runTriggers(flags.triggersPath, flags.shouldSemantic)
    return
  }
  if (flags.shouldReplay) {
    await runReplayOrUsage(flags.member, flags.replayLimit, flags.shouldJson)
    return
  }
  if (flags.shouldHistory) {
    printHistoryOrUsage(flags.member)
    return
  }
  if (flags.memberB) {
    await runABOrUsage(flags.member, flags.memberB, flags.suitePath, flags.shouldJson)
    return
  }
  await runSuiteMode(flags)
}

async function runReplayOrUsage(member: string | undefined, replayLimit: number, shouldJson: boolean): Promise<void> {
  if (!member) {
    printUsage()
    process.exit(1)
  }
  await runReplay(member, replayLimit, shouldJson)
}

function printHistoryOrUsage(member: string | undefined): void {
  if (!member) {
    printUsage()
    process.exit(1)
  }
  printHistory(member)
}

async function runABOrUsage(member: string | undefined, memberB: string | undefined, suitePath: string | undefined, shouldJson: boolean): Promise<void> {
  if (!member || !memberB || !suitePath) {
    printUsage()
    process.exit(1)
  }
  await runABComparison(member, memberB, suitePath, shouldJson)
}

/** The default mode: one suite run, or a cross-provider comparison. */
async function runSuiteMode(flags: ParsedEvalArgs): Promise<void> {
  const { member, suitePath, baselinePath, benchmarkPath, providers, shouldUpdateBaseline, shouldJson, shouldConvergence } = flags
  if (!member || !suitePath) {
    printUsage()
    process.exit(1)
  }

  const suite = loadSuiteOrExit(suitePath)

  // Two or more --provider flags switch to comparison mode: the suite runs
  // once per provider and a summary table ranks them (#596).
  if (providers.length >= 2) {
    await runProviderComparison(member, suite, providers, shouldJson)
    return
  }

  const config = await loadConfigOrExit(providers[0])
  const report = await runSuiteOnce(member, suite, config)

  if (benchmarkPath) writeBenchmark(report, benchmarkPath, config)

  recordRun(report)
  await finishWithBaseline(report, member, baselinePath, shouldUpdateBaseline, shouldJson)

  if (shouldConvergence && !shouldJson) printConvergence(member, suite.name)
}

/** One suite run against one config: context, runner and judge wiring. */
async function runSuiteOnce(member: string, suite: EvalSuite, config: LLMConfig): Promise<EvalReport> {
  const app = await ApplicationContext.create(process.cwd(), config)
  app.ctx.source = 'automated'

  if (!app.members.has(member)) {
    console.error(`Unknown member: "${member}"`)
    process.exit(1)
  }

  const runner = (task: string) => app.runner.runMemberTask(member, task, config)
  const judge = new LLMJudge(app.llm)
  return new EvalRunner(runner, judge, { embed: (text) => app.llm.embed(text) }).run(suite, member)
}

/** Runs the suite once per provider and folds each report into a Benchmark. */
async function runSuiteBenchmark(
  member: string,
  suite: EvalSuite,
  provider: string,
): Promise<ReturnType<typeof buildBenchmark>> {
  const config = await loadConfigOrExit(provider)
  const report = await runSuiteOnce(member, suite, config)
  return buildBenchmark(report, { provider: config.provider, model: config.model })
}

async function runProviderComparison(member: string, suite: EvalSuite, providers: string[], shouldJson: boolean): Promise<void> {
  for (const p of providers) {
    if (!ApplicationContext.knownProviders().includes(p)) {
      console.error(`Unknown provider: "${p}"`)
      console.error(`Known providers: ${ApplicationContext.knownProviders().join(', ')}`)
      process.exit(1)
    }
  }
  const benchmarks = []
  for (const p of providers) {
    benchmarks.push(await runSuiteBenchmark(member, suite, p))
  }
  if (shouldJson) {
    console.log(JSON.stringify(benchmarks, null, 2))
  } else {
    printProviderComparison(benchmarks)
  }
}


function recordRun(report: EvalReport): void {
  let passedCount = 0
  let evaluatedCount = 0
  for (const t of report.tasks) {
    const result = taskPassed(t)
    if (result === null) continue
    evaluatedCount++
    if (result) passedCount++
  }
  const passRate = evaluatedCount === 0 ? -1 : Math.round((passedCount / evaluatedCount) * 10000) / 10000
  const durationMs = report.tasks.reduce((sum, t) => sum + t.durationMs, 0)

  const record: EvalRunRecord = {
    version: '0.0.0',
    timestamp: report.timestamp,
    member: report.member,
    suiteName: report.suiteName,
    passRate,
    aggregate: report.aggregate,
    taskCount: report.tasks.length,
    durationMs,
  }
  try {
    new RunHistory(report.member).append(record)
  } catch (err) {
    console.error(`Warning: failed to record eval history: ${err instanceof Error ? err.message : String(err)}`)
  }
}



/** Persists a standardized benchmark.json and prints a one-line summary. */
function writeBenchmark(report: EvalReport, benchmarkPath: string, config: { provider?: string; model?: string }): void {
  const benchmark = buildBenchmark(report, { provider: config.provider, model: config.model })
  mkdirSync(dirname(benchmarkPath), { recursive: true })
  writeFileSync(benchmarkPath, `${JSON.stringify(benchmark, null, 2)}\n`, 'utf8')
  const pct = benchmark.passRate === null ? 'n/a' : `${(benchmark.passRate * 100).toFixed(0)}%`
  console.log(`\n  Benchmark: ${benchmarkPath} — pass_rate ${pct}, avg ${benchmark.avgTimeMs ?? 0}ms, ${benchmark.avgTokens ?? 0} tok\n`)
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

/** Scores activation trigger rates from a query set; loads a provider only for --semantic. */
async function runTriggers(triggersPath: string, semantic: boolean): Promise<void> {
  let set
  try {
    set = loadTriggerSet(triggersPath)
  } catch (err) {
    if (err instanceof SchemaValidationError) {
      console.error(`Invalid trigger set: ${err.message}`)
      process.exit(2)
    }
    throw err
  }
  let embed: EmbedFn | undefined
  if (semantic) {
    const config = await loadConfigOrExit()
    const app = await ApplicationContext.create(process.cwd(), config)
    embed = (text: string) => app.llm.embed(text)
  }
  await runTriggerRate(set, { embed })
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

