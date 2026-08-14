import { describe, it, expect, vi } from 'vitest'
import { LLMJudge, parseJudgeScore } from '../../../src/evals/EvalJudge.js'
import type { ILLMProvider } from '../../../src/llm/ILLMProvider.js'
import type { LLMRequest, LLMResponse, LLMChunk } from '../../../src/llm/types.js'

function stubProvider(overrides: Partial<ILLMProvider> = {}): ILLMProvider {
  return {
    async complete(_req: LLMRequest): Promise<LLMResponse> {
      return { content: '0.75', usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, model: 'stub' }
    },
    async stream(_req: LLMRequest): Promise<AsyncGenerator<LLMChunk>> {
      async function* gen(): AsyncGenerator<LLMChunk> { yield { delta: '', done: true } }
      return gen()
    },
    async embed(text: string): Promise<number[]> {
      return text === 'target' ? [1, 0] : [0, 1]
    },
    getContextWindow(): number { return 8192 },
    setModel: vi.fn(),
    ...overrides,
  }
}

const context = { input: 'question', output: 'the answer', expected: 'target' }

describe('LLMJudge', () => {
  it('scores LLM-judged metrics by parsing the bare number from the reply', async () => {
    const complete = vi.fn(async (req: LLMRequest): Promise<LLMResponse> => {
      const user = req.messages.at(-1)?.content ?? ''
      return { content: user.includes('faithful') ? '0.9' : '0.6', usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, model: 'stub' }
    })
    const judge = new LLMJudge(stubProvider({ complete }))

    expect(await judge.score('faithfulness', context)).toBe(0.9)
    expect(await judge.score('relevance', context)).toBe(0.6)
    expect(complete).toHaveBeenCalledTimes(2)
  })

  it('asks for a bare numeric score without a JSON contract', async () => {
    const complete = vi.fn(async (req: LLMRequest): Promise<LLMResponse> => {
      return { content: '0.5', usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, model: 'stub' }
    })
    await new LLMJudge(stubProvider({ complete })).score('faithfulness', context)

    const req = complete.mock.calls[0][0]
    expect(req.temperature).toBe(0)
    expect(req.messages[0].role).toBe('system')
    const userContent = req.messages.at(-1)?.content as string
    expect(userContent).toContain('question')
    expect(userContent).toContain('the answer')
    expect(userContent).toContain('target')
  })

  it('scores answer_correctness with embedding cosine similarity', async () => {
    const judge = new LLMJudge(stubProvider())
    expect(await judge.score('answer_correctness', context)).toBe(0)
  })

  it('returns 1 for identical embeddings', async () => {
    const provider = stubProvider({ async embed(_text: string) { return [1, 0] } })
    expect(await new LLMJudge(provider).score('answer_correctness', context)).toBe(1)
  })

  it('returns null for unknown metrics', async () => {
    const judge = new LLMJudge(stubProvider())
    expect(await judge.score('sentiment', context)).toBeNull()
  })

  it('returns null when the LLM call fails', async () => {
    const provider = stubProvider({
      async complete(): Promise<LLMResponse> {
        throw new Error('provider down')
      },
    })
    expect(await new LLMJudge(provider).score('faithfulness', context)).toBeNull()
  })

  it('returns null when embedding fails', async () => {
    const provider = stubProvider({
      async embed(_text: string): Promise<number[]> {
        throw new Error('no embeddings')
      },
    })
    expect(await new LLMJudge(provider).score('answer_correctness', context)).toBeNull()
  })

  it('returns null when the reply contains no number', async () => {
    const provider = stubProvider({
      async complete(): Promise<LLMResponse> {
        return { content: 'the answer looks great', usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, model: 'stub' }
      },
    })
    expect(await new LLMJudge(provider).score('faithfulness', context)).toBeNull()
  })
})

describe('parseJudgeScore', () => {
  it('parses a decimal between 0 and 1', () => {
    expect(parseJudgeScore('0.85')).toBe(0.85)
  })

  it('parses a percentage-style score', () => {
    expect(parseJudgeScore('85')).toBe(0.85)
  })

  it('parses scores embedded in prose', () => {
    expect(parseJudgeScore('Score: 0.5. It was fine.')).toBe(0.5)
  })

  it('handles the boundaries', () => {
    expect(parseJudgeScore('0')).toBe(0)
    expect(parseJudgeScore('1')).toBe(1)
  })

  it('treats values above 1 as percentages', () => {
    expect(parseJudgeScore('1.7')).toBe(0.017)
    expect(parseJudgeScore('900')).toBe(1)
  })

  it('returns null when no number is present', () => {
    expect(parseJudgeScore('no score here')).toBeNull()
    expect(parseJudgeScore('')).toBeNull()
  })
})
