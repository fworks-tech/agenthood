import { describe, it, expect, vi } from 'vitest'

vi.mock('../llm/LLMRouter.ts', () => ({
  LLMRouter: {
    knownProviders: () => ['groq', 'openai', 'anthropic', 'ollama', 'stub'],
    reinitializeProvider: vi.fn().mockResolvedValue({ chat: vi.fn() }),
  },
}))

vi.mock('./config.ts', () => ({
  loadConfig: vi.fn().mockResolvedValue({ provider: 'groq', apiKey: 'old-key' }),
}))

import { command } from '../../../src/commands/rotate-key.ts'

describe('rotate-key command', () => {
  it('has correct descriptor', () => {
    expect(command.name).toBe('rotate-key')
    expect(command.description).toContain('API key')
    expect(typeof command.handler).toBe('function')
  })
})
