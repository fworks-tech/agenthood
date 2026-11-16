/**
 * Parsed-skill metadata cache (ADR-038, #614, #617). Keyed by SKILL.md path and
 * validated by mtime + size: a hit skips the read, the YAML parse and the
 * injection scan, and a rewritten file costs one stat. Entries not seen in the
 * current run are dropped, so deleting skills does not leave them cached.
 */

import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export interface CachedManifest<T> {
  mtimeMs: number
  size: number
  /** Whatever the caller derived from the file — replayed without reading it again. */
  value: T
}

interface CacheFile<T> {
  version: 1
  entries: Record<string, CachedManifest<T>>
  misses: number
  hits: number
}

export const CACHE_VERSION = 1

export function skillCacheDir(projectPath: string): string {
  return join(projectPath, '.agenthood', 'skill-cache')
}

export function metadataCachePath(projectPath: string): string {
  return join(skillCacheDir(projectPath), 'metadata.json')
}

export function outputCacheDir(projectPath: string): string {
  return join(skillCacheDir(projectPath), 'output')
}

/**
 * A per-run view over the metadata cache. `lookup` only returns an entry whose
 * stat still matches; `remember` records what this run parsed; `persist` writes
 * the cache with only the entries this run saw.
 */
export class ManifestCache<T> {
  private entries: Record<string, CachedManifest<T>> = {}
  private seen = new Set<string>()
  private hits = 0
  private misses = 0

  constructor(private readonly projectPath: string) {
    const path = metadataCachePath(projectPath)
    if (!existsSync(path)) return
    try {
      const parsed = JSON.parse(readFileSync(path, 'utf8')) as CacheFile<T>
      if (parsed.version === CACHE_VERSION && parsed.entries) this.entries = parsed.entries
    } catch {
      // A corrupt cache is a cold cache, not a failure.
    }
  }

  lookup(filePath: string): CachedManifest<T> | undefined {
    this.seen.add(filePath)
    const entry = this.entries[filePath]
    if (!entry) return undefined
    try {
      const stat = statSync(filePath)
      if (stat.mtimeMs !== entry.mtimeMs || stat.size !== entry.size) return undefined
    } catch {
      return undefined
    }
    this.hits++
    return entry
  }

  remember(filePath: string, value: T): void {
    this.seen.add(filePath)
    this.misses++
    try {
      const stat = statSync(filePath)
      this.entries[filePath] = { mtimeMs: stat.mtimeMs, size: stat.size, value }
    } catch {
      // The file vanished between parse and remember — nothing to cache.
    }
  }

  persist(): void {
    const kept: Record<string, CachedManifest<T>> = {}
    for (const path of this.seen) {
      const entry = this.entries[path]
      if (entry) kept[path] = entry
    }
    this.entries = kept
    try {
      mkdirSync(skillCacheDir(this.projectPath), { recursive: true })
      writeFileSync(
        metadataCachePath(this.projectPath),
        `${JSON.stringify({ version: CACHE_VERSION, entries: kept, hits: this.hits, misses: this.misses }, null, 2)}\n`,
        'utf8',
      )
    } catch {
      // A cache that cannot be written still works in memory.
    }
  }

  stats(): { entries: number; hits: number; misses: number } {
    return { entries: Object.keys(this.entries).length, hits: this.hits, misses: this.misses }
  }
}

/** Entries and counters from the persisted metadata cache, for `cache stats`. */
export function readMetadataStats(projectPath: string): { entries: number; hits: number; misses: number } {
  try {
    const parsed = JSON.parse(readFileSync(metadataCachePath(projectPath), 'utf8')) as CacheFile<unknown>
    return {
      entries: Object.keys(parsed.entries ?? {}).length,
      hits: parsed.hits ?? 0,
      misses: parsed.misses ?? 0,
    }
  } catch {
    return { entries: 0, hits: 0, misses: 0 }
  }
}

/** Drops every skill cache: metadata, cached outputs and spilled script output. */
export function clearSkillCaches(projectPath: string): void {
  rmSync(skillCacheDir(projectPath), { recursive: true, force: true })
  rmSync(join(projectPath, '.agenthood', 'skill-output'), { recursive: true, force: true })
}
