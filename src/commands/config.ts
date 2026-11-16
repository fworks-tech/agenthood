import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import type { CatalogFormatName, LLMConfig, ProviderEntry, RemoteCatalogSource, RemoteCatalogsConfig, SkillsConfig } from '../llm/types.ts'

function pickBlock(raw: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  const block = raw[key]
  if (!block || typeof block !== 'object') return undefined
  return block as Record<string, unknown>
}

function parseProviderBlock(raw: Record<string, unknown>): { provider?: string; model?: string } {
  const provider = raw.provider
  if (typeof provider === 'string') {
    const model = raw.model
    return { provider, model: typeof model === 'string' ? model : undefined }
  }
  const block = pickBlock(raw, 'provider')
  if (!block) return {}
  return { provider: block.name as string | undefined, model: block.model as string | undefined }
}

function parseProviders(raw: Record<string, unknown>): ProviderEntry[] | undefined {
  if (!Array.isArray(raw.providers)) return undefined
  const entries: ProviderEntry[] = []
  for (const p of raw.providers) {
    if (!p || typeof p !== 'object') continue
    const entry = p as Record<string, unknown>
    if (typeof entry.name !== 'string') continue
    entries.push({
      name: entry.name,
      model: entry.model as string | undefined,
      apiKey: entry.apiKey as string | undefined,
      baseUrl: entry.baseUrl as string | undefined,
      models: Array.isArray(entry.models) ? (entry.models as string[]) : undefined,
      priority: entry.priority as number | undefined,
    })
  }
  return entries.length > 0 ? entries : undefined
}

function parseFailover(raw: Record<string, unknown>): Pick<LLMConfig, 'failureThreshold' | 'cooldownMs' | 'probeEnabled' | 'requestTimeoutMs'> {
  const f = pickBlock(raw, 'failover')
  if (!f) return {}
  return {
    failureThreshold: f.failureThreshold as number | undefined,
    cooldownMs: f.cooldownMs as number | undefined,
    probeEnabled: f.probeEnabled as boolean | undefined,
    requestTimeoutMs: f.requestTimeoutMs as number | undefined,
  }
}

/**
 * Remote catalogs are advisory, so a malformed source is skipped with a warning
 * instead of failing the run — unlike metricsExport, where a silently disabled
 * exporter is a monitoring lie.
 */
function parseRemoteCatalogs(raw: Record<string, unknown>): RemoteCatalogsConfig | undefined {
  const block = pickBlock(raw, 'remoteCatalogs')
  if (!block) return undefined
  const config: RemoteCatalogsConfig = {}
  if (typeof block.ttlSeconds === 'number' && block.ttlSeconds > 0) config.ttlSeconds = block.ttlSeconds
  if (Array.isArray(block.sources)) {
    const sources: RemoteCatalogSource[] = []
    for (const entry of block.sources) {
      if (!entry || typeof entry !== 'object') continue
      const item = entry as Record<string, unknown>
      if (typeof item.url !== 'string' || item.url.length === 0) {
        console.warn('[config] remoteCatalogs.sources entry without a "url" — skipped')
        continue
      }
      sources.push({
        url: item.url,
        ...(typeof item.tokenEnv === 'string' && item.tokenEnv.length > 0 ? { tokenEnv: item.tokenEnv } : {}),
      })
    }
    if (sources.length > 0) config.sources = sources
  }
  return config
}

function parseSkills(raw: Record<string, unknown>): SkillsConfig | undefined {
  const skills = pickBlock(raw, 'skills')
  if (!skills) return undefined
  const config: SkillsConfig = { autoDiscover: skills.autoDiscover === true }

  const format = skills.catalogFormat
  if (format === 'xml' || format === 'json' || format === 'text') {
    config.catalogFormat = format
  } else if (format !== undefined) {
    console.warn(`[run] skills.catalogFormat "${String(format)}" is not xml|json|text — using the provider default`)
  }

  const providerFormats = pickBlock(skills, 'providerFormats')
  if (providerFormats) {
    const table: Record<string, CatalogFormatName> = {}
    for (const [provider, value] of Object.entries(providerFormats)) {
      if (value === 'xml' || value === 'json' || value === 'text') table[provider] = value
    }
    if (Object.keys(table).length > 0) config.providerFormats = table
  }

  if (Array.isArray(skills.disabled)) {
    const disabled = skills.disabled.filter((name): name is string => typeof name === 'string')
    if (disabled.length > 0) config.disabled = disabled
  }

  if (skills.fallback === false) config.fallback = false

  return config
}

function parseSentry(raw: Record<string, unknown>): { dsn?: string } | undefined {
  const sentry = pickBlock(raw, 'sentry')
  if (!sentry) return undefined
  const dsn = sentry.dsn
  if (typeof dsn !== 'string' || dsn.length === 0 || !dsn.startsWith('http')) {
    console.warn('[run] invalid sentry.dsn in config — Sentry error reporting disabled')
    return undefined
  }
  return { dsn }
}

function parseSecurity(raw: Record<string, unknown>): { strictSkillIntegrity?: boolean; sandbox?: boolean } | undefined {
  const security = pickBlock(raw, 'security')
  if (!security) return undefined
  return {
    strictSkillIntegrity: security.strictSkillIntegrity === true,
    sandbox: security.sandbox === true,
  }
}

export async function loadConfig(providerOverride?: string): Promise<LLMConfig> {
  const configPath = join(process.cwd(), '.agenthood', 'config.json')
  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(await readFile(configPath, 'utf8')) as Record<string, unknown>
  } catch (err) {
    if (err instanceof SyntaxError) {
      // corrupt config must not silently fall back to defaults
      throw new Error(`Invalid JSON in ${configPath}: ${(err as Error).message}`, { cause: err })
    }
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return providerOverride ? { provider: providerOverride } : {}
    }
    // unreadable config (EACCES, EISDIR, ...) must not silently fall back
    throw new Error(`Cannot read ${configPath}: ${(err as Error).message}`, { cause: err })
  }

  const cfg: LLMConfig = { ...parseProviderBlock(raw), ...parseFailover(raw) }
  const providers = parseProviders(raw)
  if (providers) cfg.providers = providers
  const skills = parseSkills(raw)
  if (skills) cfg.skills = skills
  const remoteCatalogs = parseRemoteCatalogs(raw)
  if (remoteCatalogs) cfg.remoteCatalogs = remoteCatalogs
  const sentry = parseSentry(raw)
  if (sentry) cfg.sentry = sentry
  const security = parseSecurity(raw)
  if (security) cfg.security = security
  if (providerOverride) cfg.provider = providerOverride
  return cfg
}

/** CLI-facing wrapper: exits (not throws) so exit ownership stays in the command layer. */
export async function loadConfigOrExit(providerOverride?: string): Promise<LLMConfig> {
  try {
    return await loadConfig(providerOverride)
  } catch (err) {
    console.error((err as Error).message)
    process.exit(1)
  }
}
