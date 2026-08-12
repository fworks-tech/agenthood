import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OllamaProvider } from '../../../src/llm/providers/OllamaProvider.ts'
import type { LLMRequest } from '../../../src/llm/types.ts'

const BASE_URL = 'http://localhost:11434'
const req: LLMRequest = { messages: [{ role: 'user', content: 'hello' }] }

function provider(overrides: Record<string, unknown> = {}): OllamaProvider {
  return new OllamaProvider({ baseUrl: BASE_URL, model: 'llama3.2', ...overrides })
}

describe('OllamaProvider', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('returns content and usage from the chat response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ message: { content: 'hi', role: 'assistant' }, done: true, prompt_eval_count: 3, eval_count: 4 }),
    })))
    const result = await provider().complete(req)
    expect(result.content).toBe('hi')
    expect(result.usage).toEqual({ promptTokens: 3, completionTokens: 4, totalTokens: 7 })
    expect(fetch).toHaveBeenCalledWith(`${BASE_URL}/api/chat`, expect.objectContaining({ method: 'POST' }))
  })

  it('throws a friendly connect error when Ollama is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('fetch failed') }))
    await expect(provider().complete(req)).rejects.toThrow(
      `OllamaProvider: Cannot connect to ${BASE_URL}. Ensure Ollama is running (ollama serve).`,
    )
  })

  it('wraps non-connection failures with the method name', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      const e = new Error('boom')
      ;(e as Error & { cause?: unknown }).cause = 'x'
      throw e
    }))
    await expect(provider().complete(req)).rejects.toThrow('OllamaProvider.complete() failed: boom')
  })

  it('stream() throws the friendly connect error, not the raw fetch error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    await expect(provider().stream(req)).rejects.toThrow(
      `OllamaProvider: Cannot connect to ${BASE_URL}. Ensure Ollama is running (ollama serve).`,
    )
  })

  it('stream() yields chunks from NDJSON lines', async () => {
    const chunks = [
      '{"message":{"content":"hel","role":"assistant"}}',
      '{"message":{"content":"lo","role":"assistant"}}',
      '{"done":true}',
    ]
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      body: {
        getReader: () => {
          let i = 0
          const encoder = new TextEncoder()
          return {
            read: async () => i < chunks.length
              ? { done: false, value: encoder.encode(chunks[i++] + '\n') }
              : { done: true, value: undefined },
          }
        },
      },
    })))
    const gen = await provider().stream(req)
    const deltas: string[] = []
    for await (const chunk of gen) deltas.push(chunk.delta)
    expect(deltas).toEqual(['hel', 'lo', ''])
  })

  it('embed() wraps connection failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    await expect(provider().embed('text')).rejects.toThrow(
      `OllamaProvider: Cannot connect to ${BASE_URL}. Ensure Ollama is running (ollama serve).`,
    )
  })

  it('setModel and getContextWindow behave', () => {
    const p = provider()
    p.setModel('llama3.1')
    expect(p.getContextWindow()).toBe(8192)
  })
})
