import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BaseAgent } from '../../../src/agents/base/BaseAgent.ts'
import { ReActLoop } from '../../../src/reasoning/ReActLoop.ts'
import { ToolRegistry } from '../../../src/tools/ToolRegistry.ts'
import { createTestContext } from '../../helpers/testContext.ts'
import type { ILLMProvider } from '../../../src/llm/ILLMProvider.ts'
import type { LongTermMemory } from '../../../src/core/types.ts'
import type { ExecutionContext } from '../../../src/core/ExecutionContext.ts'
import type { ITool } from '../../../src/tools/ITool.ts'
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
  protected tools: ITool[] = []

  protected async getSystemPrompt(): Promise<string> {
    return 'test system prompt'
  }
}

describe('BaseAgent', () => {
  let llm: ILLMProvider
  let toolRegistry: ToolRegistry
  let loop: ReActLoop
  let mockLongTerm: LongTermMemory
  let mockResidual: ResidualMemory
  let mockLearner: EpisodeLearner

  beforeEach(() => {
    llm = createMockLLM()
    toolRegistry = new ToolRegistry()
    loop = new ReActLoop(llm, toolRegistry)

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
    const agent = new TestAgent(llm, loop, toolRegistry, mockResidual, mockLearner)
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

    const agent = new TestAgent(llm, loop, toolRegistry, mockResidual, slowLearner)
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
    const agent = new TestAgent(llm, loop, toolRegistry)
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

    const agent = new TestAgent(llm, loop, toolRegistry, mockResidual, brokenLearner)
    const context = createTestContext({
      memory: {
        ...createTestContext().memory,
        longTerm: mockLongTerm,
      },
    })

    const result = await agent.run('test task', context)
    expect(result.role).toBe('test-agent')
  })

  it('records one decision and one provenance entry per run', async () => {
    const recordDecision = vi.fn().mockResolvedValue(undefined)
    const trackProvenance = vi.fn().mockResolvedValue(undefined)
    const context = createTestContext({
      memory: {
        ...createTestContext().memory,
        longTerm: mockLongTerm,
        decisions: {
          ...createTestContext().memory.decisions,
          record: recordDecision,
        },
        provenance: {
          ...createTestContext().memory.provenance,
          track: trackProvenance,
        },
      },
    })

    const agent = new TestAgent(llm, loop, toolRegistry)
    await agent.run('test task', context)

    expect(recordDecision).toHaveBeenCalledOnce()
    const [entry] = recordDecision.mock.calls[0]
    expect(entry).toMatchObject({
      member: 'test-agent',
      task: 'test task',
      outcome: 'completed',
      confidence: 1,
      decisionMaker: 'test-agent',
      tags: ['run'],
    })

    expect(trackProvenance).toHaveBeenCalledOnce()
    const [prov] = trackProvenance.mock.calls[0]
    expect(prov).toMatchObject({
      entityId: context.executionId,
      entityType: 'decision',
      activityId: 'run:test-agent',
      agentId: 'test-agent',
      agentType: 'software_agent',
      metadata: { success: true },
    })
  })

  it('emits a trace envelope after a successful run', async () => {
    const agent = new TestAgent(llm, loop, toolRegistry)
    const context = createTestContext()

    await agent.run('test task', context)

    const traces = context.tracer.getRecent(1)
    expect(traces).toHaveLength(1)
    const env = traces[0]
    expect(env).toMatchObject({
      member: 'test-agent',
      status: 'success',
      correlationId: context.executionId,
      source: 'api',
      qualityScore: null,
      tokenCount: { input: 10, output: 10, total: 20 },
    })
    expect(env.durationMs).toBeGreaterThanOrEqual(0)
    expect(env.inputHash).toHaveLength(64)
    expect(env.outputHash).toHaveLength(64)
    expect(new Date(env.timestamp).getTime()).not.toBeNaN()
  })

  it('emits a trace envelope with error status when run fails', async () => {
    const failingLlm: ILLMProvider = {
      ...llm,
      complete: vi.fn().mockRejectedValue(new Error('provider exploded')),
    }
    const failingLoop = new ReActLoop(failingLlm, new ToolRegistry())
    const agent = new TestAgent(failingLlm, failingLoop, new ToolRegistry())
    const context = createTestContext()

    await expect(agent.run('test task', context)).rejects.toThrow('provider exploded')

    const traces = context.tracer.getRecent(1)
    expect(traces).toHaveLength(1)
    expect(traces[0]).toMatchObject({ member: 'test-agent', status: 'error' })
  })

  it('does not block the response when trace recording fails', async () => {
    const brokenTracer = {
      startSpan: vi.fn(),
      endSpan: vi.fn(),
      record: vi.fn().mockImplementation(() => {
        throw new Error('tracer exploded')
      }),
      getRecent: vi.fn(() => []),
      getByMember: vi.fn(() => []),
      getByCorrelationId: vi.fn(() => []),
    }
    const agent = new TestAgent(llm, loop, toolRegistry)
    const context = createTestContext({ tracer: brokenTracer })

    const result = await agent.run('test task', context)
    expect(result.role).toBe('test-agent')
  })

  it('records a failed decision and rethrows the error', async () => {
    const recordDecision = vi.fn().mockResolvedValue(undefined)
    const trackProvenance = vi.fn().mockResolvedValue(undefined)
    const failingLlm: ILLMProvider = {
      ...llm,
      complete: vi.fn().mockRejectedValue(new Error('provider exploded')),
    }
    const failingLoop = new ReActLoop(failingLlm, new ToolRegistry())
    const agent = new TestAgent(failingLlm, failingLoop, new ToolRegistry())
    const context = createTestContext({
      memory: {
        ...createTestContext().memory,
        decisions: {
          ...createTestContext().memory.decisions,
          record: recordDecision,
        },
        provenance: {
          ...createTestContext().memory.provenance,
          track: trackProvenance,
        },
      },
    })

    await expect(agent.run('test task', context)).rejects.toThrow('provider exploded')

    expect(recordDecision).toHaveBeenCalledOnce()
    const [entry] = recordDecision.mock.calls[0]
    expect(entry).toMatchObject({ outcome: 'failed', confidence: 0 })

    expect(trackProvenance).toHaveBeenCalledOnce()
    const [prov] = trackProvenance.mock.calls[0]
    expect(prov.metadata).toMatchObject({ success: false })
  })
})
