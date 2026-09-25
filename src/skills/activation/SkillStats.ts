import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export interface SkillStat {
  activations: number
  successes: number
  failures: number
  lastRun: string | null
}

export type SkillStats = Record<string, SkillStat>

/**
 * Per-skill usage analytics (#625). Local-only and privacy-preserving by
 * construction: it records the skill *name* and three counters, never
 * prompts, arguments, or results. Set `analytics.enabled: false` in
 * `.agenthood/config.json` to opt out.
 */
export function statsPath(projectPath: string): string {
  return join(projectPath, '.agenthood', 'skill-stats.json')
}

export function analyticsEnabled(projectPath: string): boolean {
  const configPath = join(projectPath, '.agenthood', 'config.json')
  if (!existsSync(configPath)) return true
  try {
    const config = JSON.parse(readFileSync(configPath, 'utf8')) as { analytics?: { enabled?: boolean } }
    return config.analytics?.enabled !== false
  } catch {
    return true
  }
}

export function readSkillStats(projectPath: string): SkillStats {
  const path = statsPath(projectPath)
  if (!existsSync(path)) return {}
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown
    return typeof parsed === 'object' && parsed !== null ? (parsed as SkillStats) : {}
  } catch {
    return {}
  }
}

/** Records one activation attempt. A no-op when analytics are opted out. */
export function recordSkillActivation(projectPath: string, skill: string, success: boolean): void {
  if (!analyticsEnabled(projectPath)) return
  const path = statsPath(projectPath)
  const stats = readSkillStats(projectPath)
  const stat = stats[skill] ?? { activations: 0, successes: 0, failures: 0, lastRun: null }
  stat.activations++
  if (success) stat.successes++
  else stat.failures++
  stat.lastRun = new Date().toISOString()
  stats[skill] = stat
  mkdirSync(join(projectPath, '.agenthood'), { recursive: true })
  writeFileSync(path, JSON.stringify(stats, null, 2) + '\n', 'utf8')
}

/** Successful activations as a share of attempts; null when never tried. */
export function triggerRate(stat: SkillStat): number | null {
  return stat.activations === 0 ? null : stat.successes / stat.activations
}
