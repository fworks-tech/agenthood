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
  return entry?.apiKey ?? config.apiKey
}

function primaryProvider(config: LLMConfig): string {
  if (config.provider) return config.provider
  // No explicit provider block: validate the first entry of the failover
  // chain (ascending priority), not a hardcoded groq default
  if (config.providers?.length) {
    return [...config.providers].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))[0].name
  }
  return 'groq'
}

export function validateApiKeys(config: LLMConfig): void {
  const provider = primaryProvider(config)
  const keyInfo = PROVIDER_KEYS[provider]

  if (!keyInfo) {
    return
  }

  const configKey = resolveConfigKey(config, provider)
  const envKey = process.env[keyInfo.envVar]

  if (!envKey && !configKey) {
    throw new MissingApiKeyError(provider, keyInfo.envVar, keyInfo.signupUrl)
  }
}