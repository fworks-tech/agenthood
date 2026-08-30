import type { LLMConfig, ProviderEntry } from './types.ts'

// Central registry of API-key env vars and signup URLs, also used by
// `agenthood setup` to print provider guidance
export const PROVIDER_KEYS: Record<string, { envVar: string; signupUrl: string }> = {
  groq: { envVar: 'GROQ_API_KEY', signupUrl: 'https://console.groq.com' },
  openai: { envVar: 'OPENAI_API_KEY', signupUrl: 'https://platform.openai.com/api-keys' },
  anthropic: { envVar: 'ANTHROPIC_API_KEY', signupUrl: 'https://console.anthropic.com' },
  openrouter: { envVar: 'OPENROUTER_API_KEY', signupUrl: 'https://openrouter.ai/keys' },
  opencode: { envVar: 'OPENCODE_API_KEY', signupUrl: 'https://opencode.ai' },
  'opencode-go': { envVar: 'OPENCODE_API_KEY', signupUrl: 'https://opencode.ai' },
  // ollama intentionally absent: local Ollama needs no API key
}

export class MissingApiKeyError extends Error {
  constructor(provider: string, envVar: string, signupUrl: string) {
    super(`${envVar} not set for provider "${provider}". Get a key at ${signupUrl}`)
    this.name = 'MissingApiKeyError'
  }
}

function resolveConfigKey(config: LLMConfig, provider: string): string | undefined {
  const entry: ProviderEntry | undefined = config.providers?.find((p) => p.name === provider)
  if (config.providers?.length) {
    return entry?.apiKey
  }
  return entry?.apiKey ?? config.apiKey
}

function sortProviders(a: ProviderEntry, b: ProviderEntry) {
  return (a.priority ?? 999) - (b.priority ?? 999)
}

function primaryProvider(config: LLMConfig): string {
  if (config.provider) return config.provider
  // No explicit provider block: validate the first entry of the failover
  // chain (ascending priority), not a hardcoded groq default
  if (config.providers?.length) {
    return [...config.providers].sort(sortProviders)[0].name
  }
  return 'groq'
}

export function validateApiKeys(config: LLMConfig): void {
  const sorted = config.providers?.length
    ? [...config.providers].sort(sortProviders).map((p) => p.name)
    : []
  const primary = primaryProvider(config)
  const providers = sorted.length ? (sorted.includes(primary) ? sorted : [primary, ...sorted]) : [primary]
  const seen = new Set<string>()
  for (const provider of providers) {
    if (seen.has(provider)) continue
    seen.add(provider)
    const keyInfo = PROVIDER_KEYS[provider]
    if (!keyInfo) continue
    const configKey = resolveConfigKey(config, provider)
    const envKey = process.env[keyInfo.envVar]
    if (!envKey && !configKey) {
      if (provider === primary) {
        throw new MissingApiKeyError(provider, keyInfo.envVar, keyInfo.signupUrl)
      }
      console.warn(
        `[validateApiKeys] ${keyInfo.envVar} not set for fallback provider "${provider}" — skipping. Get a key at ${keyInfo.signupUrl}`,
      )
    }
  }
}