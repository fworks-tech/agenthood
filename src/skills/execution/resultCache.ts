/**
 * Skill output cache (ADR-038, #598). Opt-in, TTL-bounded, and keyed by the
 * script's content digest as well as its arguments, so an edited script is
 * never served from cache. Only successful bundled runs are cached; one-off
 * commands have side effects outside the run and are never stored.
 */

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { outputCacheDir, skillCacheDir } from '../discovery/manifestCache.ts'

/** Default TTL: one hour. */
export const DEFAULT_OUTPUT_TTL_MS = 3_600_000

interface CachedOutput {
  createdAt: number
  output: string
}

function statsPath(projectPath: string): string {
  return join(skillCacheDir(projectPath), 'output-stats.json')
}

export function resultCacheKey(skill: string, script: string, args: string[], digest: string): string {
  return createHash('sha256').update(JSON.stringify({ skill, script, args, digest })).digest('hex')
}

function entryPath(projectPath: string, key: string): string {
  return join(outputCacheDir(projectPath), `${key}.json`)
}

/** The cached output, or undefined when absent, unreadable or past its TTL. */
export function readCachedOutput(projectPath: string, key: string, ttlMs: number, now = Date.now()): string | undefined {
  const path = entryPath(projectPath, key)
  if (!existsSync(path)) return undefined
  try {
    const entry = JSON.parse(readFileSync(path, 'utf8')) as CachedOutput
    if (now - entry.createdAt > ttlMs) return undefined
    return entry.output
  } catch {
    return undefined
  }
}

export function writeCachedOutput(projectPath: string, key: string, output: string, now = Date.now()): void {
  try {
    mkdirSync(outputCacheDir(projectPath), { recursive: true })
    writeFileSync(entryPath(projectPath, key), JSON.stringify({ createdAt: now, output }), 'utf8')
  } catch {
    // A cache that cannot be written is not a run failure.
  }
}

/** Counters live beside the entries; they are the only hit-rate source. */
export function recordCacheResult(projectPath: string, hit: boolean): void {
  const path = statsPath(projectPath)
  let stats = { hits: 0, misses: 0 }
  try {
    stats = JSON.parse(readFileSync(path, 'utf8')) as typeof stats
  } catch {
    // first run, or a corrupt file — start over
  }
  if (hit) stats.hits++
  else stats.misses++
  try {
    mkdirSync(skillCacheDir(projectPath), { recursive: true })
    writeFileSync(path, JSON.stringify(stats), 'utf8')
  } catch {
    // counters are advisory
  }
}

export function readCacheStats(projectPath: string): { hits: number; misses: number; entries: number; hitRate: number | null } {
  let hits = 0
  let misses = 0
  try {
    const parsed = JSON.parse(readFileSync(statsPath(projectPath), 'utf8')) as { hits?: number; misses?: number }
    hits = parsed.hits ?? 0
    misses = parsed.misses ?? 0
  } catch {
    // no stats yet
  }
  let entries = 0
  try {
    entries = readdirSync(outputCacheDir(projectPath)).filter((name) => name.endsWith('.json')).length
  } catch {
    // no output cache yet
  }
  const total = hits + misses
  return { hits, misses, entries, hitRate: total === 0 ? null : hits / total }
}
