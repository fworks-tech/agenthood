/**
 * Skill observability (#586, #597, #626, #627, #628).
 *
 * Four questions a project eventually asks about its skills, answered from the
 * data it already has: discovered manifests, the activation counters in
 * `.agenthood/skill-stats.json`, and the trajectory store:
 *
 *   what does it cost to keep loaded, does it still work, did it get slower,
 *   and does it earn its place.
 *
 * Pure functions and plain data. The commands decide how to print.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { countTokens } from '../core/modelPricing.ts'
import type { Trajectory } from '../core/TrajectoryStore.ts'
import type { ISkillManifest } from './discovery/ISkillManifest.ts'
import { formatSkillCatalog, type CatalogFormat } from './catalog/format.ts'
import { findMissingReferences } from './activation/references.ts'
import type { SkillStat, SkillStats } from './activation/SkillStats.ts'

/** Catalog metadata is the part every run pays for; bodies load on activation. */
export const DEFAULT_METADATA_BUDGET = 4000
export const DEFAULT_BODY_BUDGET = 5000
/** Activation monitoring is noise below this many attempts. */
export const DEFAULT_MIN_ATTEMPTS = 5
/** Below this success share, activation is treated as broken. */
export const DEFAULT_MIN_SUCCESS_RATE = 0.9
/** A mean step time this much worse than the baseline is a regression. */
export const DEFAULT_REGRESSION_THRESHOLD = 0.25
const MIN_REGRESSION_SAMPLES = 5

export interface SkillUsageRow {
  name: string
  /** Tokens this skill's catalog entry adds to every prompt. */
  metadataTokens: number
  /**
   * Tokens the body costs on activation, or null when discovery was
   * metadata-only and the body was never read. Null is not zero: an
   * unmeasured body must not report as free.
   */
  bodyTokens: number | null
  activations: number
}

/**
 * Catalog cost per skill. Rendered through the real formatter, so a hidden
 * skill costs 0 and the sum matches what the prompt actually carries.
 */
export function skillUsage(
  manifests: ISkillManifest[],
  stats: SkillStats,
  format: CatalogFormat = 'xml',
): SkillUsageRow[] {
  return manifests
    .map((manifest) => ({
      name: manifest.name,
      metadataTokens: countTokens(formatSkillCatalog([manifest], { format })),
      bodyTokens: manifest.body === '' ? null : countTokens(manifest.body),
      activations: stats[manifest.name]?.activations ?? 0,
    }))
    .sort((a, b) => b.metadataTokens - a.metadataTokens)
}

/** `skills.metadataBudget` in `.agenthood/config.json`, defaulting to 4000. */
export function metadataBudget(projectPath: string): number {
  const config = readConfig(projectPath)
  const configured = (config.skills as { metadataBudget?: unknown } | undefined)?.metadataBudget
  return typeof configured === 'number' && configured > 0 ? configured : DEFAULT_METADATA_BUDGET
}

export interface SkillHealthProblem {
  skill: string
  level: 'error' | 'warn'
  message: string
  fix: string
}

/**
 * Per-skill health (#597): a body that points at files that are gone, a name
 * that disagrees with its directory, a manifest discovery let through with no
 * description. Missing references are a warning: a script may create them.
 */
export function skillHealth(manifests: ISkillManifest[]): SkillHealthProblem[] {
  const problems: SkillHealthProblem[] = []
  for (const manifest of manifests) {
    if (!manifest.description?.trim()) {
      problems.push({
        skill: manifest.name,
        level: 'error',
        message: 'no description; the catalog cannot tell the model when to use it',
        fix: 'Add a description that front-loads the trigger keywords.',
      })
    }
    if (!manifest.body.trim()) {
      problems.push({
        skill: manifest.name,
        level: 'error',
        message: 'empty body; activating it adds nothing to the prompt',
        fix: 'Write the Process section, or remove the skill.',
      })
    }
    if (basename(manifest.directory) !== manifest.name) {
      problems.push({
        skill: manifest.name,
        level: 'error',
        message: `directory "${basename(manifest.directory)}" does not match name "${manifest.name}"`,
        fix: 'Rename the directory or the frontmatter name so they agree.',
      })
    }
    for (const missing of findMissingReferences(manifest.body, manifest.directory)) {
      problems.push({
        skill: manifest.name,
        level: 'warn',
        message: `references "${missing}" which does not exist`,
        fix: 'Create the file, or remove the reference if it is stale.',
      })
    }
  }
  return problems
}

export interface ActivationRate {
  skill: string
  attempts: number
  successes: number
  rate: number
}

/** Every skill with at least one recorded attempt, worst rate first (#626). */
export function activationRates(stats: SkillStats): ActivationRate[] {
  return Object.entries(stats)
    .filter(([, stat]: [string, SkillStat]) => stat.activations > 0)
    .map(([skill, stat]) => ({
      skill,
      attempts: stat.activations,
      successes: stat.successes,
      rate: stat.successes / stat.activations,
    }))
    .sort((a, b) => a.rate - b.rate)
}

/** Skills whose success rate dropped under the threshold with enough samples. */
export function failingActivations(
  stats: SkillStats,
  minAttempts = DEFAULT_MIN_ATTEMPTS,
  minRate = DEFAULT_MIN_SUCCESS_RATE,
): ActivationRate[] {
  return activationRates(stats).filter((entry) => entry.attempts >= minAttempts && entry.rate < minRate)
}

export interface SkillSpeed {
  meanMs: number
  samples: number
}

/**
 * Mean step duration per active skill, from the trajectory store (#627). A step
 * contributes to every skill active when it ran; a skill with no timed steps is
 * absent rather than zero.
 */
export function speedBySkill(trajectories: Trajectory[]): Record<string, SkillSpeed> {
  const totals: Record<string, { sum: number; samples: number }> = {}
  for (const trajectory of trajectories) {
    for (const step of trajectory.steps ?? []) {
      if (typeof step.durationMs !== 'number') continue
      for (const skill of step.skills ?? []) {
        const entry = (totals[skill] ??= { sum: 0, samples: 0 })
        entry.sum += step.durationMs
        entry.samples++
      }
    }
  }
  const speeds: Record<string, SkillSpeed> = {}
  for (const [skill, entry] of Object.entries(totals)) {
    speeds[skill] = { meanMs: Math.round(entry.sum / entry.samples), samples: entry.samples }
  }
  return speeds
}

export interface Regression {
  skill: string
  baselineMs: number
  currentMs: number
  /** Fraction slower than the baseline, e.g. 0.4 for 40% worse. */
  change: number
  samples: number
}

/**
 * Current mean against a stored baseline. No t-test: a fixed proportional
 * threshold plus a minimum sample size is explainable and does not need a
 * statistics dependency. `--baseline` re-stamps after an intentional change.
 */
export function detectRegressions(
  current: Record<string, SkillSpeed>,
  baseline: Record<string, number>,
  threshold = DEFAULT_REGRESSION_THRESHOLD,
): Regression[] {
  const regressions: Regression[] = []
  for (const [skill, speed] of Object.entries(current)) {
    const base = baseline[skill]
    if (base === undefined || base <= 0 || speed.samples < MIN_REGRESSION_SAMPLES) continue
    const change = (speed.meanMs - base) / base
    if (change > threshold) {
      regressions.push({ skill, baselineMs: base, currentMs: speed.meanMs, change, samples: speed.samples })
    }
  }
  return regressions.sort((a, b) => b.change - a.change)
}

export function baselinePath(projectPath: string): string {
  return join(projectPath, '.agenthood', 'skill-baseline.json')
}

export function readBaseline(projectPath: string): Record<string, number> {
  const path = baselinePath(projectPath)
  if (!existsSync(path)) return {}
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Record<string, number>
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

/** Stamps the current means as the baseline (manual baseline setting, #627). */
export function writeBaseline(projectPath: string, speeds: Record<string, SkillSpeed>): Record<string, number> {
  const baseline: Record<string, number> = {}
  for (const [skill, speed] of Object.entries(speeds)) baseline[skill] = speed.meanMs
  mkdirSync(join(projectPath, '.agenthood'), { recursive: true })
  writeFileSync(baselinePath(projectPath), `${JSON.stringify(baseline, null, 2)}\n`, 'utf8')
  return baseline
}

export interface CostSuggestion {
  skill: string
  metadataTokens: number
  activations: number
  suggestion: string
}

/**
 * Which skills do not earn their catalog cost (#628). Deliberately quiet on a
 * project with no activation history: "never activated" is not evidence of
 * waste before anything has run.
 */
export function costSuggestions(rows: SkillUsageRow[]): CostSuggestion[] {
  if (!rows.some((row) => row.activations > 0)) return []

  const suggestions: CostSuggestion[] = []
  for (const row of rows) {
    if (row.activations === 0) {
      suggestions.push({
        skill: row.name,
        metadataTokens: row.metadataTokens,
        activations: 0,
        suggestion: 'never activated; remove it, or set `disable-model-invocation: true` to keep it out of the catalog',
      })
      continue
    }
    if (row.activations <= 2 && row.metadataTokens >= 200) {
      suggestions.push({
        skill: row.name,
        metadataTokens: row.metadataTokens,
        activations: row.activations,
        suggestion: 'rarely activated and a large catalog entry; compress the description and move detail into the body',
      })
    }
  }
  return suggestions.sort((a, b) => b.metadataTokens - a.metadataTokens)
}

function readConfig(projectPath: string): Record<string, unknown> {
  const path = join(projectPath, '.agenthood', 'config.json')
  if (!existsSync(path)) return {}
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}
