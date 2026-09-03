import { describe, it, expect, afterEach } from 'vitest'
import { LLMRouter } from '../../../src/llm/LLMRouter.ts'
import { STUB_PROVIDER_ENV, StubProvider } from '../../../src/llm/providers/StubProvider.ts'

afterEach(() => {
  delete process.env[STUB_PROVIDER_ENV]
  StubProvider.resetScript()
})

describe('StubProvider', () => {
  it('refuses to construct without the env gate', () => {
    expect(() => new StubProvider({})).toThrow(`${STUB_PROVIDER_ENV}=1`)
  })

  it('replays scripted steps in order, then empty content', async () => {
    process.env[STUB_PROVIDER_ENV] = '1'
    StubProvider.enqueueScript([
      { content: '', toolCalls: [{ id: 'call-1', name: 'ask_human', args: { question: 'Proceed?', context: 'scope' } }] },
      { content: 'done' },
    ])
    const stub = new StubProvider({})
    const first = await stub.complete({ messages: [{ role: 'user', content: 'hi' }] })
    expect(first.toolCalls).toHaveLength(1)
    expect(first.toolCalls?.[0].name).toBe('ask_human')
    const second = await stub.complete({ messages: [{ role: 'user', content: 'hi' }] })
    expect(second.content).toBe('done')
    expect(second.toolCalls).toBeUndefined()
    const third = await stub.complete({ messages: [{ role: 'user', content: 'hi' }] })
    expect(third.content).toBe('')
  })

  it('streams the scripted content then done', async () => {
    process.env[STUB_PROVIDER_ENV] = '1'
    StubProvider.enqueueScript([{ content: 'hello' }])
    const stub = new StubProvider({})
    const chunks = []
    for await (const chunk of await stub.stream({ messages: [{ role: 'user', content: 'hi' }] })) {
      chunks.push(chunk)
    }
    expect(chunks).toEqual([{ delta: 'hello', done: false }, { delta: '', done: true }])
  })

  it('resolves through the router by provider name', async () => {
    process.env[STUB_PROVIDER_ENV] = '1'
    const provider = await LLMRouter.create({ provider: 'stub' })
    expect(provider).toBeInstanceOf(StubProvider)
  })
})
