import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import type { CatalogFormatName, LLMConfig, McpServerConfig, ProviderEntry, RemoteCatalogSource, RemoteCatalogsConfig, SkillsConfig } from '../llm/types.ts'

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
 * instead of failing the run: unlike metricsExport, where a silently disabled
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
        console.warn('[config] remoteCatalogs.sources entry without a "url", skipped')
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

/**
 * The opt-out is a trust-boundary switch (#1071): a typo must not silently keep
 * injecting contributor docs into every prompt, so a non-boolean fails the run.
 */
function parseRepoInstructions(raw: Record<string, unknown>): boolean | undefined {
  const value = raw.repoInstructions
  if (value === undefined) return undefined
  if (typeof value !== 'boolean') {
    throw new Error(
      `Invalid repoInstructions in .agenthood/config.json: expected true or false, got ${JSON.stringify(value)}.`,
    )
  }
  return value
}

const MCP_SERVER_NAME = /^[a-z0-9][a-z0-9-]*$/
const MCP_SERVER_KEYS = new Set(['command', 'args', 'env', 'readOnly', 'transport', 'url', 'headers'])

const SENSITIVE_KEY = /api[_-]?key|token|secret|password|credential|bearer|pat|jwt|auth/i
const ENV_REF = /^\$\{env:([A-Za-z0-9_]+)\}$/

function resolveEnvValue(where: string, key: string, value: unknown): string {
  if (typeof value !== 'string') throw new Error(`${where}: env.${key} must be a string.`)
  if (!/^[A-Za-z0-9_]+$/.test(key)) throw new Error(`${where}: env key "${key}" must match [A-Za-z0-9_]+.`)
  const ref = ENV_REF.exec(value)
  if (ref) {
    const varName = ref[1]
    if (process.env[varName] === undefined) throw new Error(`${where}: env.${key} references missing variable ${varName}.`)
    return process.env[varName] as string
  }
  if (ENV_REF.test(value) === false && value.includes('${env:')) {
    // partial/interpolated reference is not allowed in v1
    throw new Error(`${where}: env.${key} must be either a literal or a single \${env:VAR} reference.`)
  }
  if (SENSITIVE_KEY.test(key)) {
    throw new Error(`${where}: env.${key} is secret-like and must use \${env:VAR}, not a literal value.`)
  }
  return value
}

/**
 * A server is a process the host spawns, so every field is checked before any
 * spawn (ADR-047): an unknown key or a malformed command is a typo that must not
 * silently run nothing or something else.
 */
function parseMcpServers(raw: Record<string, unknown>): Record<string, McpServerConfig> | undefined {
  if (raw.mcpServers === undefined) return undefined
  const block = raw.mcpServers
  if (!block || typeof block !== 'object' || Array.isArray(block)) {
    throw new Error(`Invalid mcpServers in .agenthood/config.json: expected an object of servers, got ${JSON.stringify(block)}.`)
  }
  const servers: Record<string, McpServerConfig> = {}
  for (const [name, def] of Object.entries(block)) {
    const where = `Invalid mcpServers.${name} in .agenthood/config.json`
    if (!MCP_SERVER_NAME.test(name)) throw new Error(`${where}: server names must match [a-z0-9][a-z0-9-]*.`)
    if (!def || typeof def !== 'object' || Array.isArray(def)) throw new Error(`${where}: expected an object with "command" and "args".`)
    for (const key of Object.keys(def)) {
      if (!MCP_SERVER_KEYS.has(key)) throw new Error(`${where}: unknown key "${key}".`)
    }
    const { command, args = [], env, readOnly, transport, url, headers } = def as Record<string, unknown>
    const t = transport === undefined ? 'stdio' : transport
    if (t !== 'stdio' && t !== 'http') throw new Error(`${where}: "transport" must be "stdio" or "http".`)
    if (readOnly !== undefined && typeof readOnly !== 'boolean') {
      throw new Error(`${where}: "readOnly" must be a boolean.`)
    }

    let resolvedEnv: Record<string, string> | undefined
    if (env !== undefined) {
      if (!env || typeof env !== 'object' || Array.isArray(env)) throw new Error(`${where}: "env" must be an object.`)
      resolvedEnv = {}
      for (const [key, val] of Object.entries(env)) {
        resolvedEnv[key] = resolveEnvValue(where, key, val)
      }
    }

    let resolvedHeaders: Record<string, string> | undefined
    if (headers !== undefined) {
      if (!headers || typeof headers !== 'object' || Array.isArray(headers)) throw new Error(`${where}: "headers" must be an object.`)
      resolvedHeaders = {}
      for (const [key, val] of Object.entries(headers)) {
        resolvedHeaders[key] = resolveEnvValue(where, key, val)
      }
    }

    if (t === 'stdio') {
      if (typeof command !== 'string' || command.trim() === '') throw new Error(`${where}: "command" must be a non-empty string.`)
      if (!Array.isArray(args) || !args.every((arg) => typeof arg === 'string')) {
        throw new Error(`${where}: "args" must be an array of strings.`)
      }
      if (url !== undefined) throw new Error(`${where}: "url" is not allowed for stdio transport.`)
    } else {
      if (typeof url !== 'string' || !/^https?:\/\//.test(url)) throw new Error(`${where}: "url" must be an http(s) URL.`)
      if (command !== undefined) throw new Error(`${where}: "command" is not allowed for http transport.`)
      if (args !== undefined && args !== null) {
        // args may be omitted; if present must be array (but http ignores)
        if (!Array.isArray(args) || !args.every((arg) => typeof arg === 'string')) {
          throw new Error(`${where}: "args" must be an array of strings.`)
        }
      }
    }

    const entry: McpServerConfig = {
      ...(t === 'stdio' ? { command: command as string, args: [...(args as string[])] } : {}),
      ...(resolvedEnv ? { env: resolvedEnv } : {}),
      ...(readOnly === true ? { readOnly: true } : {}),
      ...(t === 'http' ? { transport: 'http' as const } : {}),
      ...(t === 'http' ? { url: url as string } : {}),
      ...(resolvedHeaders ? { headers: resolvedHeaders } : {}),
    }
    servers[name] = entry
  }
  return servers
}

function parseSkills(raw: Record<string, unknown>): SkillsConfig | undefined {
  const skills = pickBlock(raw, 'skills')
  if (!skills) return undefined
  const config: SkillsConfig = {}

  const format = skills.catalogFormat
  if (format === 'xml' || format === 'json' || format === 'text') {
    config.catalogFormat = format
  } else if (format !== undefined) {
    console.warn(`[run] skills.catalogFormat "${String(format)}" is not xml|json|text: using the provider default`)
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

  const timeout = skills.scriptTimeoutMs
  if (typeof timeout === 'number' && Number.isInteger(timeout) && timeout > 0) {
    config.scriptTimeoutMs = timeout
  } else if (timeout !== undefined) {
    console.warn(`[run] skills.scriptTimeoutMs "${String(timeout)}" is not a positive integer: using the default`)
  }

  const cacheTtl = skills.cacheTtlMs
  if (typeof cacheTtl === 'number' && Number.isInteger(cacheTtl) && cacheTtl > 0) {
    config.cacheTtlMs = cacheTtl
  } else if (cacheTtl !== undefined) {
    console.warn(`[run] skills.cacheTtlMs "${String(cacheTtl)}" is not a positive integer: using the default`)
  }
  if (skills.cacheOutputs === true) config.cacheOutputs = true

  return config
}

function parseSentry(raw: Record<string, unknown>): { dsn?: string } | undefined {
  const sentry = pickBlock(raw, 'sentry')
  if (!sentry) return undefined
  const dsn = sentry.dsn
  if (typeof dsn !== 'string' || dsn.length === 0 || !dsn.startsWith('http')) {
    console.warn('[run] invalid sentry.dsn in config, Sentry error reporting disabled')
    return undefined
  }
  return { dsn }
}

function parseSecurity(
  raw: Record<string, unknown>,
): { strictSkillIntegrity?: boolean; sandbox?: boolean; autoAllowSkillDirs?: boolean; trustedAuthors?: string[] } | undefined {
  const security = pickBlock(raw, 'security')
  if (!security) return undefined
  const trustedAuthors = Array.isArray(security.trustedAuthors)
    ? security.trustedAuthors.filter((author): author is string => typeof author === 'string')
    : undefined
  return {
    strictSkillIntegrity: security.strictSkillIntegrity === true,
    sandbox: security.sandbox === true,
    ...(security.autoAllowSkillDirs === false ? { autoAllowSkillDirs: false } : {}),
    ...(trustedAuthors && trustedAuthors.length > 0 ? { trustedAuthors } : {}),
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
  const repoInstructions = parseRepoInstructions(raw)
  if (repoInstructions !== undefined) cfg.repoInstructions = repoInstructions
  const mcpServers = parseMcpServers(raw)
  if (mcpServers) cfg.mcpServers = mcpServers
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
