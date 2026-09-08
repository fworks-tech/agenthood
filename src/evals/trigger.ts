import type { EmbedFn } from './ReplayEvaluator.ts'
import { cosineSimilarity } from '../utils/cosineSimilarity.ts'
import { MemberOrchestrator } from '../reasoning/MemberOrchestrator.ts'
import { validateSchema } from '../core/SchemaValidator.ts'
import type { JSONSchema } from '../llm/types.ts'

/** A labelled set of queries that should (or should not) activate one member. */
export interface TriggerQuerySet {
  member: string
  shouldTrigger: string[]
  shouldNotTrigger: string[]
}

/** Maps a query to the member the router would activate (null = none). */
export type Predictor = (query: string) => string | null | Promise<string | null>

export interface TriggerMetrics {
  truePositive: number
  falsePositive: number
  falseNegative: number
  trueNegative: number
  precision: number
  recall: number
  accuracy: number
  f1: number
}

export interface SplitSets {
  train: TriggerQuerySet
  validation: TriggerQuerySet
}

export const TRIGGER_QUERY_SET_SCHEMA: JSONSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['member', 'shouldTrigger', 'shouldNotTrigger'],
  properties: {
    member: { type: 'string', minLength: 1 },
    shouldTrigger: { type: 'array', items: { type: 'string', minLength: 1 } },
    shouldNotTrigger: { type: 'array', items: { type: 'string', minLength: 1 } },
  },
} as JSONSchema

export function validateTriggerQuerySet(data: unknown): void {
  validateSchema(data, TRIGGER_QUERY_SET_SCHEMA)
}

/** Deterministic activation surface: the runtime's keyword/file/stage router. */
export function keywordPredictor(orchestrator = new MemberOrchestrator()): Predictor {
  return (query) => orchestrator.getDefaultMember(orchestrator.detectMembers({ userMessage: query }))
}

/**
 * Semantic activation surface: embeds each member description once (lazily,
 * cached) and returns the closest above `minScore`, else null. Approximates how
 * a provider-side loader picks a skill from its SKILL.md description.
 */
export function semanticPredictor(
  descriptions: ReadonlyArray<{ name: string; description: string }>,
  embed: EmbedFn,
  minScore = 0.3,
): Predictor {
  let cache: Promise<Array<{ name: string; vec: number[] }>> | null = null
  return async (query) => {
    cache ??= Promise.all(descriptions.map(async (d) => ({ name: d.name, vec: await embed(d.description) })))
    const queryVec = await embed(query)
    let best: string | null = null
    let bestScore = minScore
    for (const entry of await cache) {
      const similarity = cosineSimilarity(queryVec, entry.vec)
      if (similarity >= bestScore) {
        bestScore = similarity
        best = entry.name
      }
    }
    return best
  }
}

/** Confusion matrix + derived rates for a set scored by one predictor. */
export async function scoreTriggers(set: TriggerQuerySet, predict: Predictor): Promise<TriggerMetrics> {
  let tp = 0
  let fn = 0
  let fp = 0
  let tn = 0
  for (const query of set.shouldTrigger) {
    if ((await predict(query)) === set.member) tp++
    else fn++
  }
  for (const query of set.shouldNotTrigger) {
    if ((await predict(query)) === set.member) fp++
    else tn++
  }
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp)
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn)
  const total = tp + fp + fn + tn
  const accuracy = total === 0 ? 0 : (tp + tn) / total
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall)
  return {
    truePositive: tp,
    falsePositive: fp,
    falseNegative: fn,
    trueNegative: tn,
    precision: round4(precision),
    recall: round4(recall),
    accuracy: round4(accuracy),
    f1: round4(f1),
  }
}

/**
 * Deterministic train/validation split (train first, ceil ratio). Splits both
 * buckets so either side can be scored standalone; used to guard against
 * over-fitting a description to the queries used to tune it.
 */
export function splitTriggers(set: TriggerQuerySet, trainRatio = 0.6): SplitSets {
  const cut = (arr: string[]): [string[], string[]] => {
    const n = Math.ceil(arr.length * trainRatio)
    return [arr.slice(0, n), arr.slice(n)]
  }
  const [stTrain, stVal] = cut(set.shouldTrigger)
  const [snTrain, snVal] = cut(set.shouldNotTrigger)
  return {
    train: { member: set.member, shouldTrigger: stTrain, shouldNotTrigger: snTrain },
    validation: { member: set.member, shouldTrigger: stVal, shouldNotTrigger: snVal },
  }
}

const RECALL_TARGET = 0.8
const PRECISION_TARGET = 0.8

/** Actionable hints derived from the rates (empty when both meet target). */
export function triggerRecommendations(metrics: TriggerMetrics, label = 'description'): string[] {
  const recs: string[] = []
  if (metrics.truePositive + metrics.falseNegative > 0 && metrics.recall < RECALL_TARGET) {
    recs.push(`under-triggering: ${metrics.falseNegative} should-trigger query(ies) missed — broaden ${label} with the missing phrasings`)
  }
  if (metrics.truePositive + metrics.falsePositive > 0 && metrics.precision < PRECISION_TARGET) {
    recs.push(`over-triggering: ${metrics.falsePositive} should-not-trigger query(ies) captured — narrow ${label} to specialise it`)
  }
  return recs
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}
