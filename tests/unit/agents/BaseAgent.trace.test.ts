import { describe, it, expect, vi } from 'vitest'
import { TestAgent, createAgentHarness } from '../../helpers/agentFixtures.ts'
import { createTestContext } from '../../helpers/testContext.ts'
import type { ILLMProvider } from '../../../src/llm/ILLMProvider.ts'
import { ReActLoop } from '../../../src/reasoning/ReActLoop.ts'
import { ToolRegistry } from '../../../src/tools/ToolRegistry.ts'

describe('BaseAgent trace emission', () => {
  it('emits a trace envelope after a successful run', async () => {
    const { llm, toolRegistry } = createAgentHarness()
    const bigUsageLlm: ILLMProvider = {
      ...llm,
      complete: vi.fn().mockResolvedValue({
        content: 'mock output',
        usage: { promptTokens: 1_000_000, completionTokens: 1_000_000, totalTokens: 2_000_000 },
        model: 'mock-model',
      }),
    }
    const bigUsageLoop = new ReActLoop(bigUsageLlm, new ToolRegistry())
    const agent = new TestAgent(bigUsageLlm, bigUsageLoop, toolRegistry)
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
      tokenCount: { input: 1_000_000, output: 1_000_000, total: 2_000_000 },
    })
    // mock-model is unknown → fallback pricing: $1/1M in, $3/1M out
    expect(env.cost).toBe(4)
    expect(env.model).toBe('mock-model')
    expect(env.durationMs).toBeGreaterThanOrEqual(0)
    expect(env.inputHash).toHaveLength(64)
    expect(env.outputHash).toHaveLength(64)
    expect(new Date(env.timestamp).getTime()).not.toBeNaN()
  })

  it('prefers context.correlationId over executionId in envelopes', async () => {
    const { llm, toolRegistry } = createAgentHarness()
    const bigUsageLlm: ILLMProvider = {
      ...llm,
      complete: vi.fn().mockResolvedValue({
        content: 'mock output',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        model: 'mock-model',
      }),
    }
    const agent = new TestAgent(bigUsageLlm, new ReActLoop(bigUsageLlm, new ToolRegistry()), toolRegistry)
    const context = createTestContext({ correlationId: 'workflow-corr-9' })

    await agent.run('test task', context)

    const env = context.tracer.getRecent(1)[0]
    expect(env.correlationId).toBe('workflow-corr-9')
  })

  it('stamps the envelope source from ExecutionContext when provided', async () => {
    const { llm, toolRegistry } = createAgentHarness()
    const agent = new TestAgent(llm, new ReActLoop(llm, new ToolRegistry()), toolRegistry)
    const context = createTestContext({ source: 'playground' })

    await agent.run('test task', context)

    const env = context.tracer.getRecent(1)[0]
    expect(env.source).toBe('playground')
  })

  it('falls back to the api source when ExecutionContext has none', async () => {
    const { llm, toolRegistry } = createAgentHarness()
    const agent = new TestAgent(llm, new ReActLoop(llm, new ToolRegistry()), toolRegistry)
    const context = createTestContext()

    await agent.run('test task', context)

    const env = context.tracer.getRecent(1)[0]
    expect(env.source).toBe('api')
  })

  it('sums tool-level usage from the context accumulator into the envelope', async () => {
    const { llm, toolRegistry } = createAgentHarness()
    const agent = new TestAgent(llm, new ReActLoop(llm, new ToolRegistry()), toolRegistry)
    const context = createTestContext({
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    })

    await agent.run('test task', context)

    const env = context.tracer.getRecent(1)[0]
    expect(env.tokenCount).toEqual({ input: 110, output: 60, total: 170 })
  })

  it('emits a trace envelope with error status when run fails', async () => {
    const { llm } = createAgentHarness()
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
    const { llm, toolRegistry, loop } = createAgentHarness()
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
})
