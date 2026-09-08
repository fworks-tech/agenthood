import { readFileSync } from 'node:fs'

import { rawSpecs } from '../members/member-specs.ts'
import { SchemaValidationError } from '../core/SchemaValidator.ts'
import {
  keywordPredictor,
  semanticPredictor,
  scoreTriggers,
  splitTriggers,
  triggerRecommendations,
  validateTriggerQuerySet,
} from '../evals/trigger.ts'
import type { TriggerMetrics, TriggerQuerySet } from '../evals/trigger.ts'
import type { EmbedFn } from '../evals/ReplayEvaluator.ts'

export interface SurfaceScore {
  surface: 'keyword' | 'semantic'
  metrics: TriggerMetrics
}

/** Reads + validates a trigger query-set JSON file. */
export function loadTriggerSet(path: string): TriggerQuerySet {
  let data: unknown
  try {
    data = JSON.parse(readFileSync(path, 'utf8'))
  } catch (err) {
    throw new SchemaValidationError(`cannot read trigger set "${path}": ${err instanceof Error ? err.message : String(err)}`)
  }
  validateTriggerQuerySet(data)
  return data as TriggerQuerySet
}

/** Scores the available activation surfaces; semantic only when an embedder is given. */
export async function evaluateSurfaces(
  set: TriggerQuerySet,
  options: { embed?: EmbedFn } = {},
): Promise<SurfaceScore[]> {
  const results: SurfaceScore[] = [{ surface: 'keyword', metrics: await scoreTriggers(set, keywordPredictor()) }]
  if (options.embed) {
    const predict = semanticPredictor(rawSpecs.map((s) => ({ name: s.name, description: s.description })), options.embed)
    results.push({ surface: 'semantic', metrics: await scoreTriggers(set, predict) })
  }
  // rank by F1 then accuracy, best first
  return results.sort((a, b) => b.metrics.f1 - a.metrics.f1 || b.metrics.accuracy - a.metrics.accuracy)
}

function fmt(n: number): string {
  return n.toFixed(2)
}

/** Builds the ranked per-surface report lines (pure; separated from printing for testing). */
export function formatTriggerReport(input: {
  member: string
  shouldTrigger: number
  shouldNot: number
  ranked: SurfaceScore[]
  trainF1: number
  valF1: number
  trainCount: number
  valCount: number
  recs: string[]
}): string[] {
  const lines = [
    '',
    `  Trigger rate — ${input.member}`,
    `  Queries: ${input.shouldTrigger} should-trigger, ${input.shouldNot} should-not`,
    '',
    `  ${'Surface'.padEnd(10)} ${'P'.padStart(5)} ${'R'.padStart(5)} ${'Acc'.padStart(5)} ${'F1'.padStart(5)}  TP/FP/FN/TN`,
  ]
  for (const { surface, metrics: m } of input.ranked) {
    lines.push(
      `  ${surface.padEnd(10)} ${fmt(m.precision).padStart(5)} ${fmt(m.recall).padStart(5)} ` +
        `${fmt(m.accuracy).padStart(5)} ${fmt(m.f1).padStart(5)}  ${m.truePositive}/${m.falsePositive}/${m.falseNegative}/${m.trueNegative}`,
    )
  }
  lines.push('')
  lines.push(`  Keyword split F1 — train ${fmt(input.trainF1)} (${input.trainCount}q) | validation ${fmt(input.valF1)} (${input.valCount}q)`)
  if (input.recs.length > 0) {
    lines.push('', '  Recommendations:')
    for (const line of input.recs) lines.push(line)
  } else {
    lines.push('', '  Healthy: precision and recall both at or above target.')
  }
  lines.push('')
  return lines
}

/** Prints a ranked, per-surface trigger report for one member. */
export async function runTriggerRate(set: TriggerQuerySet, options: { embed?: EmbedFn } = {}): Promise<void> {
  const ranked = await evaluateSurfaces(set, options)
  const split = splitTriggers(set)
  const train = await scoreTriggers(split.train, keywordPredictor())
  const val = await scoreTriggers(split.validation, keywordPredictor())
  const recs = ranked.flatMap(({ surface, metrics }) => triggerRecommendations(metrics, `${surface} description`).map((r) => `  [${surface}] ${r}`))
  const lines = formatTriggerReport({
    member: set.member,
    shouldTrigger: set.shouldTrigger.length,
    shouldNot: set.shouldNotTrigger.length,
    ranked,
    trainF1: train.f1,
    valF1: val.f1,
    trainCount: split.train.shouldTrigger.length,
    valCount: split.validation.shouldTrigger.length,
    recs,
  })
  for (const line of lines) console.log(line)
}
