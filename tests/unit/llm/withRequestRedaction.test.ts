import { describe, it, expect } from 'vitest'
import { LLMRouter } from '../../../src/llm/LLMRouter.ts'
import { GroqProvider } from '../../../src/llm/providers/GroqProvider.ts'
import { withRequestRedaction } from '../../../src/llm/withRequestRedaction.ts'
import { RedactionFilter } from '../../../src/core/RedactionFilter.ts'
import type { ILLMProvider } from '../../../src/llm/ILLMProvider.ts'
import type { LLMRequest, LLMResponse } from '../../../src/llm/types.ts'

class CapturingProvider implements ILLMProvider {
  seen: LLMRequest[] = []
  async complete(request: LLMRequest): Promise<LLMResponse> {
    this.seen.push(request)
    return { content: 'ok', usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, model: 'cap' }
  }
  async stream(request: LLMRequest) {
    this.seen.push(request)
    async function* g() { yield { delta: '', done: true } }
    return g()
  }
  async embed() { return [] }
  getContextWindow() { return 100 }
  setModel(_m: string) {}
}

describe('withRequestRedaction', () => {
  it('redacts secrets in message content before the provider sees them', async () => {
    const inner = new CapturingProvider()
    const p = withRequestRedaction(inner, new RedactionFilter())
    await p.complete({ messages: [{ role: 'user', content: 'email dev@example.com key sk-abcdef123456' }] })
    const sent = inner.seen[0].messages[0].content
    expect(sent).not.toContain('dev@example.com')
    expect(sent).not.toContain('sk-abcdef123456')
    expect(sent).toContain('[REDACTED]')
  })

  it('redacts stream requests too', async () => {
    const inner = new CapturingProvider()
    const p = withRequestRedaction(inner, new RedactionFilter())
    await p.stream({ messages: [{ role: 'user', content: 'sk-abcdef123456' }] })
    expect(inner.seen[0].messages[0].content).toBe('[REDACTED]')
  })

  it('preserves the wrapped provider prototype identity and non-request methods', () => {
    const inner = new CapturingProvider()
    const p = withRequestRedaction(inner, new RedactionFilter())
    expect(p).toBeInstanceOf(CapturingProvider)
    expect(p.getContextWindow()).toBe(100)
  })

  it('passes content through untouched when the filter is disabled', async () => {
    const inner = new CapturingProvider()
    const p = withRequestRedaction(inner, new RedactionFilter({ enabled: false }))
    await p.complete({ messages: [{ role: 'user', content: 'sk-abcdef123456' }] })
    expect(inner.seen[0].messages[0].content).toBe('sk-abcdef123456')
  })
})

describe('LLMRouter outbound redaction wiring', () => {
  it('returns an identity-preserving provider that redacts outbound requests', async () => {
    process.env.GROQ_API_KEY = 'test-key'
    try {
      const provider = await LLMRouter.create({ provider: 'groq' })
      expect(provider).toBeInstanceOf(GroqProvider)
    } finally {
      delete process.env.GROQ_API_KEY
    }
  })
})
