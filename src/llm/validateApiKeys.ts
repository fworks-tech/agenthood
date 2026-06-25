import type { LLMConfig, ProviderEntry } from './types.js'

const PROVIDER_KEYS: Record<string, { envVar: string; signupUrl: string }> = {
  groq: { envVar: 'GROQ_API_KEY', signupUrl: 'https://console.groq.com' },
  openai: { envVar: 'OPENAI_API_KEY', signupUrl: 'https://platform.openai.com/api-keys' },
  anthropic: { envVar: 'ANTHROPIC_API_KEY', signupUrl: 'https://console.anthropic.com' },
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

export function validateApiKeys(config: LLMConfig): void {
  const provider = config.provider ?? 'groq'
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