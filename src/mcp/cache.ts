/**
 * src/mcp/cache.ts
 *
 * Tool-list cache for host-declared MCP servers (ADR-050). Stores McpToolInfo[]
 * keyed by a hash of the server config so a second run can skip tools/list.
 */

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { McpServerConfig } from '../llm/types.ts'
import type { McpToolInfo } from './client.ts'

const PROTOCOL_VERSION = '2025-11-25'
const CACHE_VERSION = 1
const TTL_MS = 24 * 60 * 60 * 1000

function cacheDir(): string {
  return process.env.AGENTHOOD_MCP_CACHE_DIR ?? join(process.cwd(), '.agenthood', 'mcp-cache')
}

export function cacheKey(config: McpServerConfig, transport: string): string {
  const headerNames = Object.keys(config.headers ?? {}).sort()
  const headerValuesHash = createHash('sha256').update(
    headerNames.map((n) => config.headers?.[n] ?? '').join('\u0000'),
  ).digest('hex')
  const canonical = JSON.stringify({
    transport,
    command: config.command ?? '',
    args: config.args ?? [],
    url: config.url ?? '',
    headerNames,
    headerValuesHash,
    protocolVersion: PROTOCOL_VERSION,
  })
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16)
}

interface CacheEntry {
  version: number
  key: string
  fetchedAt: number
  tools: McpToolInfo[]
}

function discard(file: string): null {
  try { rmSync(file) } catch { /* ignore */ }
  return null
}

export function loadCachedTools(config: McpServerConfig, transport: string): McpToolInfo[] | null {
  if (process.env.AGENTHOOD_MCP_CACHE_REFRESH === '1') return null
  const key = cacheKey(config, transport)
  const file = join(cacheDir(), `${key}.json`)
  if (!existsSync(file)) return null
  let entry: CacheEntry
  try {
    entry = JSON.parse(readFileSync(file, 'utf8')) as CacheEntry
  } catch {
    return discard(file)
  }
  if (!entry || entry.version !== CACHE_VERSION || entry.key !== key
    || !Array.isArray(entry.tools) || typeof entry.fetchedAt !== 'number') {
    return discard(file)
  }
  if (Date.now() - entry.fetchedAt > TTL_MS) return null
  return entry.tools
}

export function saveCachedTools(config: McpServerConfig, transport: string, tools: McpToolInfo[]): void {
  const key = cacheKey(config, transport)
  const dir = cacheDir()
  try { mkdirSync(dir, { recursive: true }) } catch { /* ignore */ }
  const entry: CacheEntry = { version: CACHE_VERSION, key, fetchedAt: Date.now(), tools }
  try { writeFileSync(join(dir, `${key}.json`), JSON.stringify(entry)) } catch { /* ignore */ }
}
