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
    expect(result.length).toBeLessThanOrEqual(messages.length)
    const summary = result.find(m => m.content.startsWith('Summary of prior context:'))
    expect(summary).toBeDefined()
    expect(summary!.content).toContain('user messages')
  })

  it('never leaves an orphaned tool message at the head of the preserved tail', async () => {
    const compressor = new ContextCompressor(stubProvider(200), 0.8)
    const messages: Message[] = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'long message '.repeat(30) + '1' },
      { role: 'user', content: 'long message '.repeat(30) + '2' },
      { role: 'user', content: 'long message '.repeat(30) + '3' },
      { role: 'assistant', content: 'running', toolCalls: [{ id: 'tc1', name: 'read', args: {} }] },
      { role: 'tool', content: 'file contents', tool_call_id: 'tc1', name: 'read' },
      { role: 'user', content: 'long message '.repeat(30) + '4' },
    ]
    const result = await compressor.compress(messages, 200)
    const firstPreserved = result.findIndex(m => m.content.startsWith('Summary of prior context:')) + 1
    for (let i = firstPreserved; i < result.length; i++) {
      if (result[i].role === 'tool') {
        const prev = result[i - 1]
        expect(prev.role).toBe('assistant')
        expect((prev.toolCalls ?? []).some(tc => tc.id === result[i].tool_call_id)).toBe(true)
      }
    }
  })

  it('keeps assistant tool_calls together with protected SKILL_ACTIVATION results', async () => {
    const compressor = new ContextCompressor(stubProvider(200), 0.8)
    const messages: Message[] = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'long message '.repeat(30) + '1' },
      { role: 'assistant', content: 'activating', toolCalls: [{ id: 'tc1', name: 'read', args: {} }] },
      { role: 'tool', content: '[SKILL_ACTIVATION] protected payload', tool_call_id: 'tc1', name: 'read' },
      { role: 'user', content: 'long message '.repeat(30) + '2' },
    ]
    const result = await compressor.compress(messages, 200, true)
    const protectedIdx = result.findIndex(m => m.content === '[SKILL_ACTIVATION] protected payload')
    expect(protectedIdx).toBeGreaterThan(0)
    const prev = result[protectedIdx - 1]
    expect(prev.role).toBe('assistant')
    expect((prev.toolCalls ?? []).some(tc => tc.id === 'tc1')).toBe(true)
  })

  it('keeps every tool message paired with its assistant tool_calls predecessor', async () => {
    const compressor = new ContextCompressor(stubProvider(200), 0.8)
    const messages: Message[] = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'long message '.repeat(30) + '1' },
      { role: 'assistant', content: 'running', toolCalls: [{ id: 'tc1', name: 'read', args: {} }] },
      { role: 'tool', content: 'unprotected result', tool_call_id: 'tc1', name: 'read' },
      { role: 'user', content: 'long message '.repeat(30) + '2' },
    ]
    const result = await compressor.compress(messages, 200, true)
    result.forEach((m, i) => {
      if (m.role === 'tool') {
        const prev = result[i - 1]
        expect(prev.role).toBe('assistant')
        expect((prev.toolCalls ?? []).some(tc => tc.id === m.tool_call_id)).toBe(true)
      }
    })
  })

  it('keeps all parallel tool results paired with their tool_calls', async () => {
    const compressor = new ContextCompressor(stubProvider(200), 0.8)
    const messages: Message[] = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'long message '.repeat(30) + '1' },
      { role: 'assistant', content: 'running', toolCalls: [
        { id: 'tc1', name: 'read', args: {} },
        { id: 'tc2', name: 'search', args: {} },
      ] },
      { role: 'tool', content: '[SKILL_ACTIVATION] first result', tool_call_id: 'tc1', name: 'read' },
      { role: 'tool', content: '[SKILL_ACTIVATION] second result', tool_call_id: 'tc2', name: 'search' },
      { role: 'user', content: 'long message '.repeat(30) + '2' },
    ]
    const result = await compressor.compress(messages, 200, true)
    const first = result.find(m => m.content === '[SKILL_ACTIVATION] first result')
    const second = result.find(m => m.content === '[SKILL_ACTIVATION] second result')
    expect(first).toBeDefined()
    expect(second).toBeDefined()
    const firstIdx = result.indexOf(first!)
    const secondIdx = result.indexOf(second!)
    expect(result[firstIdx - 1].role).toBe('assistant')
    expect((result[firstIdx - 1].toolCalls ?? []).some(tc => tc.id === 'tc1')).toBe(true)
    expect(result[secondIdx - 1].content).toBe('[SKILL_ACTIVATION] first result')
  })
})
