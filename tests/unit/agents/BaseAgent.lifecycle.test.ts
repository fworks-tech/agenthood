import { describe, it, expect, vi } from 'vitest'
import { TestAgent, createAgentHarness } from '../../helpers/agentFixtures.ts'
import { createTestContext } from '../../helpers/testContext.ts'
import type { EpisodeLearner } from '../../../src/evals/EpisodeLearner.ts'
import type { ILLMProvider } from '../../../src/llm/ILLMProvider.ts'
import { ReActLoop } from '../../../src/reasoning/ReActLoop.ts'
import { ToolRegistry } from '../../../src/tools/ToolRegistry.ts'

describe('BaseAgent lifecycle', () => {
  it('calls EpisodeLearner.learn() after run() completes when injected', async () => {
    const { llm, toolRegistry, loop, mockLongTerm, mockResidual, mockLearner } = createAgentHarness()
    const agent = new TestAgent(llm, loop, toolRegistry, { residualMemory: mockResidual, episodeLearner: mockLearner })
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
    const { llm, toolRegistry, loop, mockLongTerm, mockResidual } = createAgentHarness()
    const slowLearner: EpisodeLearner = {
      learn: vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 5000))
      }),
    }

    const agent = new TestAgent(llm, loop, toolRegistry, { residualMemory: mockResidual, episodeLearner: slowLearner })
    const context = createTestContext({
      memory: {
        ...createTestContext().memory,
        longTerm: mockLongTerm,
      },
    })

    const start = Date.now()
    const result = await agent.run('test task', context)
    const elapsed = Date.now() - start

    expect(result.role).toBe('test-agent')
    expect(slowLearner.learn).toHaveBeenCalled()
    // If learn() were awaited, it would take >5000ms
    expect(elapsed).toBeLessThan(1000)
  })

  it('works without EpisodeLearner injected', async () => {
    const { llm, toolRegistry, loop, mockLongTerm } = createAgentHarness()
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
    const { llm, toolRegistry, loop, mockLongTerm, mockResidual } = createAgentHarness()
    const brokenLearner: EpisodeLearner = {
      learn: vi.fn().mockRejectedValue(new Error('eval failed')),
    }

    const agent = new TestAgent(llm, loop, toolRegistry, { residualMemory: mockResidual, episodeLearner: brokenLearner })
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
    const { llm, toolRegistry, loop, mockLongTerm } = createAgentHarness()
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

  it('records a failed decision and rethrows the error', async () => {
    const { llm, toolRegistry } = createAgentHarness()
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
