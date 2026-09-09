import { describe, it, expect } from 'vitest'
import { DescriptionOptimizer } from '../../../src/evals/descriptionOptimizer.ts'
import type { TriggerQuerySet } from '../../../src/evals/trigger.ts'
import type { ILLMProvider } from '../../../src/llm/ILLMProvider.ts'
import type { EmbedFn } from '../../../src/evals/ReplayEvaluator.ts'

const TRIGGER_SET: TriggerQuerySet = {
  member: 'the-scribe',
  shouldTrigger: [
    'write a commit message',
    'draft the changelog',
    'prepare the PR description',
  ],
  shouldNotTrigger: [
    'debug the parser',
    'write unit tests',
    'refactor this function',
  ],
}

const mockEmbed: EmbedFn = async (text: string) => {
  const vec = new Array(128).fill(0)
  for (let i = 0; i < text.length; i++) {
    vec[i % 128] += text.charCodeAt(i) / 1000
  }
  return vec
}

function mockLLM(responses: string[]): ILLMProvider {
  let callCount = 0
  return {
    complete: async () => ({
      content: responses[Math.min(callCount++, responses.length - 1)],
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      model: 'mock',
      finishReason: 'stop',
    }),
    stream: async function* () {},
    embed: mockEmbed,
    getContextWindow: () => 100000,
    setModel: () => {},
  } as ILLMProvider
}

describe('DescriptionOptimizer', () => {
  it('returns original description when no improvement found', async () => {
    const llm = mockLLM(['Writes code\nFixes bugs\nReviews PRs'])
    const optimizer = new DescriptionOptimizer(llm, mockEmbed, {
      maxIterations: 1,
      variantsPerIteration: 3,
      f1ImprovementThreshold: 0.5,
    })

    const result = await optimizer.optimize('the-scribe', TRIGGER_SET)

    expect(result.member).toBe('the-scribe')
    expect(result.iterations).toBe(1)
    expect(result.variants.length).toBe(3)
  })

  it('respects max iterations', async () => {
    const llm = mockLLM(['Optimized description A', 'Optimized description B', 'Optimized description C'])
    const optimizer = new DescriptionOptimizer(llm, mockEmbed, {
      maxIterations: 2,
      variantsPerIteration: 1,
      f1ImprovementThreshold: 0,
    })

    const result = await optimizer.optimize('the-scribe', TRIGGER_SET)

    expect(result.iterations).toBeLessThanOrEqual(2)
  })

  it('throws for unknown member', async () => {
    const llm = mockLLM(['test'])
    const optimizer = new DescriptionOptimizer(llm, mockEmbed)

    await expect(optimizer.optimize('unknown-member', TRIGGER_SET)).rejects.toThrow('Unknown member')
  })
})
