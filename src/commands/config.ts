import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import type { LLMConfig, ProviderEntry } from '../llm/types.ts'

function pickBlock(raw: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  const block = raw[key]
  if (!block || typeof block !== 'object') return undefined
  return block as Record<string, unknown>
}

function parseProviderBlock(raw: Record<string, unknown>): { provider?: string; model?: string } {
  const provider = raw.provider
  if (typeof provider === 'string') return { provider }
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

function parseFailover(raw: Record<string, unknown>): Pick<LLMConfig, 'failureThreshold' | 'cooldownMs' | 'probeEnabled'> {
  const f = pickBlock(raw, 'failover')
  if (!f) return {}
  return {
    failureThreshold: f.failureThreshold as number | undefined,
    cooldownMs: f.cooldownMs as number | undefined,
    probeEnabled: f.probeEnabled as boolean | undefined,
  }
}

function parseSkills(raw: Record<string, unknown>): { autoDiscover?: boolean } | undefined {
  const skills = pickBlock(raw, 'skills')
  if (!skills) return undefined
  return { autoDiscover: skills.autoDiscover === true }
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

export async function loadConfig(providerOverride?: string): Promise<LLMConfig> {
  const configPath = join(process.cwd(), '.agenthood', 'config.json')
  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(await readFile(configPath, 'utf8')) as Record<string, unknown>
  } catch (err) {
    if (err instanceof SyntaxError) {
      // corrupt config must not silently fall back to defaults
      console.error(`Invalid JSON in ${configPath}: ${(err as Error).message}`)
      process.exit(1)
    }
    return providerOverride ? { provider: providerOverride } : {}
  }

  const cfg: LLMConfig = { ...parseProviderBlock(raw), ...parseFailover(raw) }
  const providers = parseProviders(raw)
  if (providers) cfg.providers = providers
  const skills = parseSkills(raw)
  if (skills) cfg.skills = skills
  const sentry = parseSentry(raw)
  if (sentry) cfg.sentry = sentry
  if (providerOverride) cfg.provider = providerOverride
  return cfg
}
