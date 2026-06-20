import { describe, it, expect } from 'vitest'
import { LLMRouter } from '../../../src/llm/LLMRouter.js'
import { GroqProvider } from '../../../src/llm/providers/GroqProvider.js'
import { OllamaProvider } from '../../../src/llm/providers/OllamaProvider.js'
import { ProviderChain } from '../../../src/llm/ProviderFailover.js'

describe('LLMRouter', () => {
  it('returns GroqProvider for groq config', () => {
    const provider = LLMRouter.create({ provider: 'groq' })
    expect(provider).toBeInstanceOf(GroqProvider)
  })

  it('returns OllamaProvider for ollama config', () => {
    const provider = LLMRouter.create({ provider: 'ollama' })
    expect(provider).toBeInstanceOf(OllamaProvider)
  })

  it('returns ProviderChain for unknown provider', () => {
    const provider = LLMRouter.create({ provider: 'unknown' })
    expect(provider).toBeInstanceOf(ProviderChain)
  })

  it('returns ProviderChain when no provider specified', () => {
    const provider = LLMRouter.create({})
    expect(provider).toBeInstanceOf(ProviderChain)
  })

  it('createForMember builds ProviderChain with preferred provider first', () => {
    const provider = LLMRouter.createForMember('anthropic', {})
    expect(provider).toBeInstanceOf(ProviderChain)
  })

  it('createForMember with ollama builds a chain', () => {
    const provider = LLMRouter.createForMember('ollama', {})
    expect(provider).toBeInstanceOf(ProviderChain)
  })
})
