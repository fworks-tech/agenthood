import { LLMJudge } from '../evals/EvalJudge.ts'
import { EvalRunner } from '../evals/EvalRunner.ts'
import { BlindJudge } from '../evals/BlindJudge.ts'
import { AB_METRICS } from '../evals/EvalJudge.ts'
import { aggregateABScores, computeSignificance, determineWinner, mean } from '../evals/abComparison.ts'
import { SchemaValidationError } from '../core/SchemaValidator.ts'
import { loadEvalSuite } from '../evals/evalSuiteSchema.ts'
import { ApplicationContext } from '../runtime/ApplicationContext.ts'
import { loadConfigOrExit } from './config.ts'
import type { EvalReport } from '../evals/EvalRunner.ts'
import type { ABComparisonResult, EvalSuite } from '../evals/types.ts'

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

export async function runABComparison(memberA: string, memberB: string, suitePath: string, json: boolean): Promise<void> {
  const suite = loadSuiteOrExit(suitePath)
  const config = await loadConfigOrExit()
  const app = await ApplicationContext.create(process.cwd(), config)
  app.ctx.source = 'automated'
  validateMembersOrExit(app, memberA, memberB)

  const judge = new LLMJudge(app.llm)
  const embed = (text: string) => app.llm.embed(text)
  const runnerA = (task: string) => app.runner.runMemberTask(memberA, task, config)
  const runnerB = (task: string) => app.runner.runMemberTask(memberB, task, config)

  const [reportA, reportB] = await Promise.all([
    new EvalRunner(runnerA, judge, { embed }).run(suite, memberA),
    new EvalRunner(runnerB, judge, { embed }).run(suite, memberB),
  ])

  const taskScores = await compareAllTasks(new BlindJudge(judge), reportA, reportB, AB_METRICS)
  const { aggregateA, aggregateB } = aggregateABScores(taskScores, AB_METRICS)
  const winner = determineWinner(aggregateA, aggregateB, AB_METRICS)
  const flatDeltas = taskScores.flatMap((t) => AB_METRICS.map((m) => t.deltas[m])).filter((d) => d !== undefined)
  const significance = computeSignificance(flatDeltas)

  const result: ABComparisonResult = {
    memberA, memberB, suiteName: suite.name, taskCount: taskScores.length, metrics: AB_METRICS,
    aggregateA, aggregateB, taskScores, winner, significance,
  }

  if (json) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    printComparison(result)
  }

  if (winner === 'B') process.exit(1)
}

function validateMembersOrExit(app: ApplicationContext, memberA: string, memberB: string): void {
  if (!app.members.has(memberA)) {
    console.error(`Unknown member: "${memberA}"`)
    process.exit(1)
  }
  if (!app.members.has(memberB)) {
    console.error(`Unknown member: "${memberB}"`)
    process.exit(1)
  }
}

async function compareAllTasks(
  blindJudge: BlindJudge,
  reportA: EvalReport,
  reportB: EvalReport,
  metrics: string[],
) {
  const taskScores = []
  for (let i = 0; i < reportA.tasks.length; i++) {
    const taskA = reportA.tasks[i]
    const taskB = reportB.tasks[i]
    const score = await blindJudge.compareTask(
      taskA.input, taskA.expectedOutput, taskA.output, taskB.output, metrics,
    )
    taskScores.push(score)
  }
  return taskScores
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}\u2026` : text
}

function printComparison(result: ABComparisonResult): void {
  const { memberA, memberB, suiteName, taskCount, metrics, aggregateA, aggregateB, taskScores, winner, significance } = result
  console.log(`\n  A/B Comparison — ${memberA} (A) vs ${memberB} (B)`)
  console.log(`  Suite: ${suiteName} | Tasks: ${taskCount} | Metrics: ${metrics.join(', ')}\n`)

  const shortLabels: Record<string, string> = { clarity: 'cl', completeness: 'co', accuracy: 'ac' }
  const labels = metrics.map((m) => shortLabels[m] ?? m)

  console.log('  Per-task:')
  for (let i = 0; i < taskScores.length; i++) {
    const t = taskScores[i]
    console.log(`  Task ${i + 1}: "${truncate(t.input, 40)}"`)
    const aParts = metrics.map((m) => `${labels[metrics.indexOf(m)]} ${(t.scoresA[m] ?? 0).toFixed(2)}`)
    const bParts = metrics.map((m) => `${labels[metrics.indexOf(m)]} ${(t.scoresB[m] ?? 0).toFixed(2)}`)
    const avgA = mean(Object.values(t.scoresA))
    const avgB = mean(Object.values(t.scoresB))
    console.log(`    A: ${aParts.join(', ')} | avg ${avgA.toFixed(3)}`)
    console.log(`    B: ${bParts.join(', ')} | avg ${avgB.toFixed(3)}`)
    const delta = avgB - avgA
    const lead = delta > 0 ? 'B' : delta < 0 ? 'A' : 'tie'
    console.log(`    Δ: ${delta >= 0 ? '+' : ''}${delta.toFixed(3)} → ${lead}`)
  }

  console.log('\n  Aggregate:')
  const header = `           ${'A'.padStart(8)} ${'B'.padStart(8)} ${'Δ'.padStart(8)}`
  console.log(header)
  for (const m of metrics) {
    const a = (aggregateA[m] ?? 0).toFixed(2)
    const b = (aggregateB[m] ?? 0).toFixed(2)
    const d = ((aggregateB[m] ?? 0) - (aggregateA[m] ?? 0))
    const dStr = `${d >= 0 ? '+' : ''}${d.toFixed(2)}`
    console.log(`  ${m.padEnd(10)} ${a.padStart(8)} ${b.padStart(8)} ${dStr.padStart(8)}`)
  }

  const sigStr = significance.significant ? `significant, p=${significance.pValue.toFixed(3)}` : `not significant, p=${significance.pValue.toFixed(3)}`
  console.log(`\n  Winner: ${winner === 'tie' ? 'tie' : winner} (${sigStr})`)
  console.log(`  Effect: ${significance.effectLabel} (Cohen's d = ${significance.effectSize.toFixed(2)})\n`)
}
