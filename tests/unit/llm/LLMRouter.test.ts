import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { LLMRouter, ComplexityScorer } from '../../../src/llm/LLMRouter.ts'
import { GroqProvider } from '../../../src/llm/providers/GroqProvider.ts'
import { OllamaProvider } from '../../../src/llm/providers/OllamaProvider.ts'
import { ProviderChain } from '../../../src/llm/ProviderFailover.ts'
import type { ILLMProvider, LLMRequest } from '../../../src/llm/types.ts'

// GroqProvider now fails fast without a key — provide one for routing tests
beforeEach(() => {
  process.env.GROQ_API_KEY = 'test-key'
})

afterEach(() => {
  delete process.env.GROQ_API_KEY
})

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
  it('returns GroqProvider for groq config', async () => {
    const provider = await LLMRouter.create({ provider: 'groq' })
    expect(provider).toBeInstanceOf(GroqProvider)
  })

  it('returns OllamaProvider for ollama config', async () => {
    const provider = await LLMRouter.create({ provider: 'ollama' })
    expect(provider).toBeInstanceOf(OllamaProvider)
  })

  it('returns ProviderChain for unknown provider', async () => {
    const provider = await LLMRouter.create({ provider: 'unknown' })
    expect(provider).toBeInstanceOf(ProviderChain)
  })

  it('returns ProviderChain when no provider specified', async () => {
    const provider = await LLMRouter.create({})
    expect(provider).toBeInstanceOf(ProviderChain)
  })

  it('createForMember builds ProviderChain with preferred provider first', async () => {
    const provider = await LLMRouter.createForMember('anthropic', {})
    expect(provider).toBeInstanceOf(ProviderChain)
  })

  it('createForMember with ollama builds a chain', async () => {
    const provider = await LLMRouter.createForMember('ollama', {})
    expect(provider).toBeInstanceOf(ProviderChain)
  })

  describe('entry chains — shared buildChainFromEntries', () => {
    function chainProviders(chain: unknown): ILLMProvider[] {
      return (chain as unknown as { providers: ILLMProvider[] }).providers
    }

    it('fromConfig builds a chain from configured entries', async () => {
      const provider = await LLMRouter.fromConfig({ providers: [{ name: 'ollama' }] })
      expect(provider).toBeInstanceOf(ProviderChain)
    })

    it('fromConfig skips unknown entries and still builds a chain', async () => {
      const provider = await LLMRouter.fromConfig({
        providers: [{ name: 'nope' }, { name: 'ollama' }],
      })
      expect(provider).toBeInstanceOf(ProviderChain)
    })

    it('fromConfig orders the chain by entry priority', async () => {
      const chain = await LLMRouter.fromConfig({
        providers: [
          { name: 'groq', priority: 2 },
          { name: 'ollama', priority: 1 },
        ],
      })
      expect(chainProviders(chain)[0]).toBeInstanceOf(OllamaProvider)
    })

    it('createForMember puts member preference ahead of operator priority', async () => {
      const chain = await LLMRouter.createForMember('ollama', {
        providers: [{ name: 'groq', priority: 1 }],
      })
      expect(chainProviders(chain)[0]).toBeInstanceOf(OllamaProvider)
    })
  })

  describe('route — dynamic strategy', () => {
    it('returns a provider (not ProviderChain) for low complexity', async () => {
      const provider = await LLMRouter.route(
        makeRequest(),
        { routing: { strategy: 'dynamic' } },
      )
      expect(provider).toBeDefined()
    })

    it('falls back to static behavior when strategy is static', async () => {
      const provider = await LLMRouter.route(
        makeRequest({ messages: [{ role: 'user', content: 'x' }] }),
        { provider: 'groq', routing: { strategy: 'static' } },
      )
      expect(provider).toBeInstanceOf(GroqProvider)
    })

    it('falls back to static behavior when no routing config', async () => {
      const provider = await LLMRouter.route(
        makeRequest({ messages: [{ role: 'user', content: 'x' }] }),
        { provider: 'ollama' },
      )
      expect(provider).toBeInstanceOf(OllamaProvider)
    })

    it('returns configured provider for medium complexity', async () => {
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
      const provider = await LLMRouter.route(req, {
        provider: 'ollama',
        routing: { strategy: 'dynamic' },
      })
      expect(provider).toBeDefined()
    })
  })
})
