import { describe, it, expect, vi } from 'vitest'
import { ContextCompressor } from '../../../src/core/ContextCompressor.js'
import type { ILLMProvider } from '../../../src/llm/ILLMProvider.js'
import type { Message } from '../../../src/llm/types.js'
import type { LLMRequest, LLMResponse, LLMChunk } from '../../../src/llm/types.js'

function stubProvider(contextWindow = 8192): ILLMProvider {
  return {
    async complete(_req: LLMRequest): Promise<LLMResponse> {
      return { content: '', usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, model: 'stub' }
    },
    async stream(_req: LLMRequest): Promise<AsyncGenerator<LLMChunk>> {
      async function* gen(): AsyncGenerator<LLMChunk> { yield { delta: '', done: true } }
      return gen()
    },
    async embed(_text: string): Promise<number[]> { return [] },
    getContextWindow(): number { return contextWindow },
    setModel: vi.fn(),
  }
}

function makeMessages(count: number): Message[] {
  const msgs: Message[] = [
    { role: 'system' as const, content: 'You are a helpful assistant.' },
  ]
  for (let i = 0; i < count - 1; i++) {
    msgs.push({ role: 'user' as const, content: 'This is a long message that will consume enough tokens to push the total over the threshold and trigger compression of the conversation history. '.repeat(3) + i })
  }
  return msgs
}

describe('ContextCompressor', () => {
  it('returns messages unchanged when under threshold', async () => {
    const compressor = new ContextCompressor(stubProvider(100000), 0.8)
    const messages = makeMessages(3)
    const result = await compressor.compress(messages, 100000)
    expect(result).toEqual(messages)
  })

  it('compresses messages when over threshold', async () => {
    const compressor = new ContextCompressor(stubProvider(200), 0.8)
    const messages = makeMessages(10)
    const result = await compressor.compress(messages, 200)
    expect(result.length).toBeLessThan(messages.length)
    expect(result[0]).toEqual(messages[0])
  })

  it('preserves system prompt verbatim', async () => {
    const compressor = new ContextCompressor(stubProvider(200), 0.8)
    const messages = makeMessages(10)
    const result = await compressor.compress(messages, 200)
    expect(result[0].role).toBe('system')
    expect(result[0].content).toBe('You are a helpful assistant.')
  })

  it('preserves last 3 messages verbatim', async () => {
    const compressor = new ContextCompressor(stubProvider(200), 0.8)
    const messages = makeMessages(10)
    const result = await compressor.compress(messages, 200)
    const last3 = messages.slice(-3)
    const resultLast3 = result.slice(-3)
    expect(resultLast3).toEqual(last3)
  })

  it('returns empty array for empty input', async () => {
    const compressor = new ContextCompressor(stubProvider(), 0.8)
    const result = await compressor.compress([], 8192)
    expect(result).toEqual([])
  })

  it('returns single message unchanged', async () => {
    const compressor = new ContextCompressor(stubProvider(100), 0.8)
    const messages: Message[] = [{ role: 'user', content: 'hi' }]
    const result = await compressor.compress(messages, 100)
    expect(result).toEqual(messages)
  })

  it('uses provider getContextWindow when no modelContextWindow given', async () => {
    const provider = stubProvider(5000)
    const compressor = new ContextCompressor(provider, 0.8)
    const messages = makeMessages(3)
    const result = await compressor.compress(messages)
    expect(result).toEqual(messages)
  })

  it('includes summary about tool calls when present', async () => {
    const compressor = new ContextCompressor(stubProvider(10), 0.8)
    const messages: Message[] = [
      { role: 'system', content: 'system prompt here' },
      { role: 'user', content: 'do something with the tool' },
      { role: 'assistant', content: 'ok, running it now', toolCalls: [{ id: '1', name: 'test', args: {} }] },
      { role: 'tool', content: 'done executing', name: 'test' },
      { role: 'user', content: 'what happened next' },
      { role: 'assistant', content: 'all done now' },
    ]
    const result = await compressor.compress(messages, 10)
    expect(result.length).toBeLessThan(messages.length)
    const summary = result.find(m => m.content.startsWith('Summary of prior context:'))
    expect(summary).toBeDefined()
    expect(summary!.content).toContain('assistant responses')
  })
})
