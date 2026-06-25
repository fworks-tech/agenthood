import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { validateApiKeys, MissingApiKeyError } from '../../../src/llm/validateApiKeys.js'
import type { LLMConfig } from '../../../src/llm/types.js'

const ENV_VARS = ['GROQ_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY'] as const
const ORIGINAL: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const v of ENV_VARS) {
    ORIGINAL[v] = process.env[v]
    delete process.env[v]
  }
})

afterEach(() => {
  for (const v of ENV_VARS) {
    if (ORIGINAL[v] !== undefined) {
      process.env[v] = ORIGINAL[v]
    } else {
      delete process.env[v]
    }
  }
})

describe('validateApiKeys', () => {
  it('throws MissingApiKeyError when groq selected and no GROQ_API_KEY', () => {
    expect(() => validateApiKeys({ provider: 'groq' })).toThrow(MissingApiKeyError)
  })

  it('error message includes signup URL for groq', () => {
    try {
      validateApiKeys({ provider: 'groq' })
      throw new Error('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(MissingApiKeyError)
      expect((err as Error).message).toContain('https://console.groq.com')
      expect((err as Error).message).toContain('GROQ_API_KEY')
    }
  })

  it('passes when GROQ_API_KEY is set for groq provider', () => {
    process.env.GROQ_API_KEY = 'test-key'
    expect(() => validateApiKeys({ provider: 'groq' })).not.toThrow()
  })

  it('throws when openai selected and no OPENAI_API_KEY', () => {
    expect(() => validateApiKeys({ provider: 'openai' })).toThrow(MissingApiKeyError)
  })

  it('error message includes signup URL for openai', () => {
    try {
      validateApiKeys({ provider: 'openai' })
      throw new Error('should have thrown')
    } catch (err) {
      expect((err).message).toContain('https://platform.openai.com/api-keys')
    }
  })

  it('passes when OPENAI_API_KEY is set for openai provider', () => {
    process.env.OPENAI_API_KEY = 'test-key'
    expect(() => validateApiKeys({ provider: 'openai' })).not.toThrow()
  })

  it('throws when anthropic selected and no ANTHROPIC_API_KEY', () => {
    expect(() => validateApiKeys({ provider: 'anthropic' })).toThrow(MissingApiKeyError)
  })

  it('error message includes signup URL for anthropic', () => {
    try {
      validateApiKeys({ provider: 'anthropic' })
      throw new Error('should have thrown')
    } catch (err) {
      expect((err).message).toContain('https://console.anthropic.com')
    }
  })

  it('passes when ANTHROPIC_API_KEY is set for anthropic provider', () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    expect(() => validateApiKeys({ provider: 'anthropic' })).not.toThrow()
  })

  it('skips validation entirely for ollama provider', () => {
    expect(() => validateApiKeys({ provider: 'ollama' })).not.toThrow()
  })

  it('skips validation for unknown providers (no key required)', () => {
    expect(() => validateApiKeys({ provider: 'custom-local' })).not.toThrow()
  })

  it('validates only the selected provider, not others', () => {
    process.env.GROQ_API_KEY = 'test-key'
    expect(() => validateApiKeys({ provider: 'groq' })).not.toThrow()
  })

  it('uses apiKey from config.providers entries when env var missing', () => {
    const config: LLMConfig = {
      provider: 'groq',
      providers: [{ name: 'groq', apiKey: 'config-provided-key' }],
    }
    expect(() => validateApiKeys(config)).not.toThrow()
  })

  it('throws when apiKey is empty string in providers entry', () => {
    const config: LLMConfig = {
      provider: 'groq',
      providers: [{ name: 'groq', apiKey: '' }],
    }
    expect(() => validateApiKeys(config)).toThrow(MissingApiKeyError)
  })

  it('does not call process.exit', () => {
    const spy = vi.spyOn(process, 'exit') as any
    try {
      validateApiKeys({ provider: 'groq' })
    } catch {}
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})