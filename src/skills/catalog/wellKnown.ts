/**
 * `.well-known/agentskills` catalog distribution (ADR-035 §3-4).
 *
 * A catalog is an advisory listing of skills hosted elsewhere. It never replaces
 * local discovery: when the network, the token or the payload is bad, the caller
 * degrades to local skills instead of failing a run.
 */

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { load as loadYaml } from 'js-yaml'
import { fetchRemoteText, validateRemoteUrl } from '../discovery/RemoteSkillSource.ts'

export interface CatalogEntry {
  name: string
  owner?: string
  description?: string
  version?: string
  /** Absolute https URL of the SKILL.md. */
  url: string
  /** `sha256-<base64>` over the SKILL.md bytes. Advisory. */
  integrity?: string
  tier?: string
  license?: string
}

export interface SkillCatalog {
  version: 1
  skills: CatalogEntry[]
}

export interface CatalogSource {
  /** Base URL or the full `/.well-known/agentskills` endpoint. */
  url: string
  /** Environment variable holding the bearer token. Never the token itself. */
  tokenEnv?: string
}

/** Where the returned catalog came from: `stale` is a cache older than the TTL. */
export type CatalogOrigin = 'network' | 'cache' | 'stale'

export const DEFAULT_CATALOG_TTL_SECONDS = 24 * 60 * 60

/** A base URL gets the well-known suffix; a full endpoint URL is used as-is. */
export function catalogEndpoint(raw: string): string {
  const url = validateRemoteUrl(raw)
  return /\/\.well-known\/agentskills$/.test(url) ? url : `${url.replace(/\/+$/, '')}/.well-known/agentskills`
}

export function parseCatalog(text: string): SkillCatalog {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    data = loadYaml(text)
  }
  if (!data || typeof data !== 'object') throw new Error('catalog body is not an object')
  const raw = data as Record<string, unknown>
  // An unknown format version is rejected rather than guessed at: a v2 catalog
  // read as v1 would silently drop fields.
  if (raw.version !== 1) throw new Error(`unsupported catalog version ${JSON.stringify(raw.version)}: expected 1`)
  if (!Array.isArray(raw.skills)) throw new Error('catalog has no "skills" array')

  const skills = raw.skills.map((entry, index) => {
    if (!entry || typeof entry !== 'object') throw new Error(`catalog skill #${index} is not an object`)
    const item = entry as Record<string, unknown>
    if (typeof item.name !== 'string' || item.name.trim() === '') {
      throw new Error(`catalog skill #${index} has no "name"`)
    }
    if (typeof item.url !== 'string') throw new Error(`catalog skill "${item.name}" has no "url"`)
    validateRemoteUrl(item.url)
    return {
      name: item.name.trim(),
      url: item.url,
      ...(typeof item.owner === 'string' && item.owner.trim() ? { owner: item.owner.trim() } : {}),
      ...(typeof item.description === 'string' ? { description: item.description } : {}),
      ...(typeof item.version === 'string' ? { version: item.version } : {}),
      ...(typeof item.integrity === 'string' ? { integrity: item.integrity } : {}),
      ...(typeof item.tier === 'string' ? { tier: item.tier } : {}),
      ...(typeof item.license === 'string' ? { license: item.license } : {}),
    }
  })
  return { version: 1, skills }
}

export interface LoadCatalogOptions {
  cacheDir: string
  ttlSeconds?: number
  refresh?: boolean
  /** Injectable for tests; defaults to the shared validated fetch. */
  fetchText?: (url: string, headers?: Record<string, string>) => Promise<string | undefined>
}

export interface LoadedCatalog {
  catalog: SkillCatalog
  endpoint: string
  origin: CatalogOrigin
}

export async function loadCatalog(source: CatalogSource, options: LoadCatalogOptions): Promise<LoadedCatalog> {
  const endpoint = catalogEndpoint(source.url)
  const cachePath = join(options.cacheDir, `${createHash('sha256').update(endpoint).digest('hex')}.json`)
  const cached = readCache(cachePath)
  const ttlMs = (options.ttlSeconds ?? DEFAULT_CATALOG_TTL_SECONDS) * 1000

  if (cached && !options.refresh && Date.now() - cached.fetchedAt < ttlMs) {
    return { catalog: cached.catalog, endpoint, origin: 'cache' }
  }

  const token = source.tokenEnv ? process.env[source.tokenEnv] : undefined
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined

  try {
    const text = await (options.fetchText ?? fetchRemoteText)(endpoint, headers)
    if (!text) throw new Error('empty response')
    const catalog = parseCatalog(text)
    writeCache(cachePath, catalog)
    return { catalog, endpoint, origin: 'network' }
  } catch (err) {
    // A stale catalog is still better than no listing, and local skills are
    // unaffected either way. The caller decides whether to warn or fail.
    if (cached) return { catalog: cached.catalog, endpoint, origin: 'stale' }
    throw new Error(`${endpoint} unavailable: ${(err as Error)?.message ?? err}`, { cause: err })
  }
}

interface CacheEntry {
  fetchedAt: number
  catalog: SkillCatalog
}

function readCache(path: string): CacheEntry | undefined {
  if (!existsSync(path)) return undefined
  try {
    const entry = JSON.parse(readFileSync(path, 'utf-8')) as CacheEntry
    return typeof entry.fetchedAt === 'number' && entry.catalog ? entry : undefined
  } catch {
    return undefined
  }
}

function writeCache(path: string, catalog: SkillCatalog): void {
  mkdirSync(dirname(path), { recursive: true })
  const entry: CacheEntry = { fetchedAt: Date.now(), catalog }
  writeFileSync(path, JSON.stringify(entry, null, 2) + '\n', 'utf-8')
}

/** Display ref for a catalog entry: `owner/name` when the owner is known. */
export function catalogRef(entry: CatalogEntry): string {
  return entry.owner ? `${entry.owner}/${entry.name}` : entry.name
}
