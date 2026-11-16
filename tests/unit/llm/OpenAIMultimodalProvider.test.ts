import { describe, it, expect, vi } from 'vitest'
import { OpenAIMultimodalProvider } from '../../../src/llm/providers/OpenAIMultimodalProvider.ts'

function makeProvider() {
  const provider = new OpenAIMultimodalProvider({ provider: 'openai', apiKey: 'test-key', model: 'gpt-4o' } as never)
  const create = vi.fn(async (params: unknown) => {
    seen.completion = params
    return {
      model: 'gpt-4o',
      choices: [{ message: { content: 'looks like a lighthouse' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    }
  })
  const seen: { completion?: unknown } = {}
  Object.assign(provider as unknown as { client: unknown }, {
    client: {
      chat: { completions: { create } },
      images: { generate: vi.fn(async () => ({ data: [{ url: 'https://img.test/a.png', revised_prompt: 'a lighthouse' }] })) },
      audio: {
        speech: { create: vi.fn(async () => ({ arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer })) },
        transcriptions: { create: vi.fn(async () => ({ text: 'hello from audio' })) },
      },
    },
  })
  return { provider, seen }
}

describe('OpenAIMultimodalProvider (#124)', () => {
  it('maps text and base64 images onto a GPT-4o vision request', async () => {
    const { provider, seen } = makeProvider()

    const response = await provider.completeMultimodal({
      system: 'be brief',
      parts: [
        { type: 'text', content: 'what is this?' },
        { type: 'image_base64', data: 'AAAA', mimeType: 'image/png' },
      ],
    })

    expect(response.content).toBe('looks like a lighthouse')
    expect(response.usage.totalTokens).toBe(15)
    const params = seen.completion as { model: string; messages: { role: string; content: unknown }[] }
    expect(params.model).toBe('gpt-4o')
    expect(params.messages[0]).toEqual({ role: 'system', content: 'be brief' })
    expect(params.messages[1].content).toEqual([
      { type: 'text', text: 'what is this?' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } },
    ])
  })

  it('rejects an audio part instead of silently dropping it', async () => {
    const { provider } = makeProvider()
    await expect(
      provider.completeMultimodal({ parts: [{ type: 'audio_base64', data: 'AAAA', mimeType: 'audio/wav' }] }),
    ).rejects.toThrow(/does not support/)
  })

  it('returns the generated image URL and revised prompt', async () => {
    const { provider } = makeProvider()
    const result = await provider.generateImage('a lighthouse', { size: '1792x1024', quality: 'hd' })
    expect(result.urls).toEqual(['https://img.test/a.png'])
    expect(result.revisedPrompt).toBe('a lighthouse')
  })

  it('returns audio bytes with the format mime type', async () => {
    const { provider } = makeProvider()
    const result = await provider.textToSpeech('hello', { format: 'mp3' })
    expect(result.mimeType).toBe('audio/mpeg')
    expect([...result.data]).toEqual([1, 2, 3])
  })

  it('transcribes audio', async () => {
    const { provider } = makeProvider()
    const result = await provider.speechToText({ data: Buffer.from('audio'), filename: 'note.wav' })
    expect(result.text).toBe('hello from audio')
  })

  it('reports video as not implemented', async () => {
    const { provider } = makeProvider()
    await expect(provider.generateVideo('a sunrise')).resolves.toMatchObject({
      status: 'not_implemented',
      availableIn: 'v4.1.0',
    })
  })
})
