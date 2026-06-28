import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BaseAgent } from '../../../src/agents/base/BaseAgent.ts'
import { ReActLoop } from '../../../src/reasoning/ReActLoop.ts'
import { SkillRegistry } from '../../../src/skills/SkillRegistry.ts'
import { createTestContext } from '../../helpers/testContext.ts'
import type { ILLMProvider } from '../../../src/llm/ILLMProvider.ts'
import type { LongTermMemory } from '../../../src/core/types.ts'
import type { ExecutionContext } from '../../../src/core/ExecutionContext.ts'
import type { ISkill } from '../../../src/skills/ISkill.ts'
import type { ResidualMemory } from '../../../src/memory/ResidualMemory.ts'
import type { EpisodeLearner } from '../../../src/evals/EpisodeLearner.ts'

function createMockLLM(): ILLMProvider {
  return {
    complete: vi.fn().mockResolvedValue({
      content: 'mock output',
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      model: 'mock-model',
    }),
    stream: vi.fn(),
    embed: vi.fn(),
    getContextWindow: vi.fn().mockReturnValue(8192),
  }
}

class TestAgent extends BaseAgent {
  role = 'test-agent'
  protected skills: ISkill[] = []

  protected async getSystemPrompt(): Promise<string> {
    return 'test system prompt'
  }
}

describe('BaseAgent', () => {
  let llm: ILLMProvider
  let skillRegistry: SkillRegistry
  let loop: ReActLoop
  let mockLongTerm: LongTermMemory
  let mockResidual: ResidualMemory
  let mockLearner: EpisodeLearner

  beforeEach(() => {
    llm = createMockLLM()
    skillRegistry = new SkillRegistry()
    loop = new ReActLoop(llm, skillRegistry)

    mockLongTerm = {
      store: vi.fn(),
      retrieve: vi.fn(),
    }

    mockResidual = {
      record: vi.fn(),
      decay: vi.fn(),
      getActive: vi.fn().mockReturnValue([]),
      toPromptHints: vi.fn().mockReturnValue(''),
      clear: vi.fn(),
      count: vi.fn().mockReturnValue(0),
    }

    mockLearner = {
      learn: vi.fn().mockResolvedValue(undefined),
    }
  })

  it('calls EpisodeLearner.learn() after run() completes when injected', async () => {
    const agent = new TestAgent(llm, loop, skillRegistry, mockResidual, mockLearner)
    const context = createTestContext({
      memory: {
        ...createTestContext().memory,
        longTerm: mockLongTerm,
      },
    })

    await agent.run('test task', context)

    expect(mockLearner.learn).toHaveBeenCalledOnce()
    const [evalResult] = vi.mocked(mockLearner.learn).mock.calls[0]
    expect(evalResult).toMatchObject({
      episodeId: context.executionId,
      metadata: { member: 'test-agent' },
    })
  })

  it('does not block agent response when EpisodeLearner.learn() is slow', async () => {
    const slowLearner: EpisodeLearner = {
      learn: vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 5000))
      }),
    }

    const agent = new TestAgent(llm, loop, skillRegistry, mockResidual, slowLearner)
    const context = createTestContext({
      memory: {
        ...createTestContext().memory,
        longTerm: mockLongTerm,
      },
    })

    // Use Promise.race to verify learn() doesn't block
    const start = Date.now()
    const result = await agent.run('test task', context)
    const elapsed = Date.now() - start

    expect(result.role).toBe('test-agent')
    expect(slowLearner.learn).toHaveBeenCalled()
    // If learn() were awaited, it would take >5000ms
    expect(elapsed).toBeLessThan(1000)
  })

  it('works without EpisodeLearner injected', async () => {
    const agent = new TestAgent(llm, loop, skillRegistry)
    const context = createTestContext({
      memory: {
        ...createTestContext().memory,
        longTerm: mockLongTerm,
      },
    })

    const result = await agent.run('test task', context)
    expect(result.role).toBe('test-agent')
    expect(result.output).toBeTruthy()
  })

  it('survives EpisodeLearner.learn() rejection without crashing', async () => {
    const brokenLearner: EpisodeLearner = {
      learn: vi.fn().mockRejectedValue(new Error('eval failed')),
    }

    const agent = new TestAgent(llm, loop, skillRegistry, mockResidual, brokenLearner)
    const context = createTestContext({
      memory: {
        ...createTestContext().memory,
        longTerm: mockLongTerm,
      },
    })

    const result = await agent.run('test task', context)
    expect(result.role).toBe('test-agent')
  })
})
