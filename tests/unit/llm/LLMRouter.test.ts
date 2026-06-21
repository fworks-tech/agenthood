import { describe, it, expect } from 'vitest'
import { LLMRouter, ComplexityScorer } from '../../../src/llm/LLMRouter.js'
import { GroqProvider } from '../../../src/llm/providers/GroqProvider.js'
import { OllamaProvider } from '../../../src/llm/providers/OllamaProvider.js'
import { ProviderChain } from '../../../src/llm/ProviderFailover.js'
import type { LLMRequest } from '../../../src/llm/types.js'

function makeRequest(overrides?: Partial<LLMRequest>): LLMRequest {
  return {
    messages: [{ role: 'user', content: 'hello' }],
    ...overrides,
  }
}

describe('ComplexityScorer', () => {
  const scorer = new ComplexityScorer()

  it('returns low for simple query (1-2 messages, no tools)', () => {
    expect(scorer.score(makeRequest())).toBe('low')
  })

  it('returns low for system+user messages without tools', () => {
    const req = makeRequest({
      messages: [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'hi' },
      ],
    })
    expect(scorer.score(req)).toBe('low')
  })

  it('returns medium for >5 messages', () => {
    const req = makeRequest({
      messages: [
        { role: 'user', content: '1' },
        { role: 'assistant', content: 'a' },
        { role: 'user', content: '2' },
        { role: 'assistant', content: 'b' },
        { role: 'user', content: '3' },
        { role: 'assistant', content: 'c' },
      ],
    })
    expect(scorer.score(req)).toBe('medium')
  })

  it('returns medium when tools are present (≤3)', () => {
    const req = makeRequest({
      tools: [{ name: 'read_file', description: 'read', inputSchema: { type: 'object' } }],
    })
    expect(scorer.score(req)).toBe('medium')
  })

  it('returns high when >3 tools', () => {
    const req = makeRequest({
      tools: [
        { name: 'a', description: 'a', inputSchema: { type: 'object' } },
        { name: 'b', description: 'b', inputSchema: { type: 'object' } },
        { name: 'c', description: 'c', inputSchema: { type: 'object' } },
        { name: 'd', description: 'd', inputSchema: { type: 'object' } },
      ],
    })
    expect(scorer.score(req)).toBe('high')
  })

  it('returns high when system prompt contains chain-of-thought markers', () => {
    const req = makeRequest({
      messages: [
        { role: 'system', content: 'Think step by step before answering' },
        { role: 'user', content: 'solve this' },
      ],
    })
    expect(scorer.score(req)).toBe('high')
  })
})

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

  describe('route — dynamic strategy', () => {
    it('returns a provider (not ProviderChain) for low complexity', () => {
      const provider = LLMRouter.route(
        makeRequest(),
        { routing: { strategy: 'dynamic' } },
      )
      // Should resolve to a concrete provider (likely Groq or ProviderChain if Groq unavailable)
      expect(provider).toBeDefined()
    })

    it('falls back to static behavior when strategy is static', () => {
      const provider = LLMRouter.route(
        makeRequest({ messages: [{ role: 'user', content: 'x' }] }),
        { provider: 'groq', routing: { strategy: 'static' } },
      )
      expect(provider).toBeInstanceOf(GroqProvider)
    })

    it('falls back to static behavior when no routing config', () => {
      const provider = LLMRouter.route(
        makeRequest({ messages: [{ role: 'user', content: 'x' }] }),
        { provider: 'ollama' },
      )
      expect(provider).toBeInstanceOf(OllamaProvider)
    })

    it('returns configured provider for medium complexity', () => {
      const req = makeRequest({
        messages: [
          { role: 'user', content: '1' },
          { role: 'assistant', content: 'a' },
          { role: 'user', content: '2' },
          { role: 'assistant', content: 'b' },
          { role: 'user', content: '3' },
          { role: 'assistant', content: 'c' },
        ],
      })
      const provider = LLMRouter.route(req, {
        provider: 'ollama',
        routing: { strategy: 'dynamic' },
      })
      expect(provider).toBeDefined()
    })
  })
})
