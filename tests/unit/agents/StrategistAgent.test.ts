import { describe, it, expect, vi } from 'vitest'
import { StrategistAgent } from '../../../src/agents/strategist/StrategistAgent.js'
import type { ExecutionContext } from '../../../src/core/ExecutionContext.js'

function mockEnv(): { agent: StrategistAgent; context: ExecutionContext } {
  const llm = {} as any
  const loop = { run: vi.fn().mockResolvedValue('## Problem Statement\nUsers cannot log in on mobile devices.\n\n## Success Criteria\n1. Login works on iOS and Android') } as any
  const skillRegistry = { has: vi.fn().mockReturnValue(false), register: vi.fn(), getSchemas: vi.fn().mockReturnValue([]), get: vi.fn(), list: vi.fn() } as any
  const agent = new StrategistAgent(llm, loop, skillRegistry)

  const context = {
    executionId: 'test',
    project: { localPath: '/test', name: 'test' },
    memory: {
      shortTerm: { add: vi.fn(), getRecent: vi.fn(), clear: vi.fn() },
      longTerm: { store: vi.fn(), retrieve: vi.fn() },
      episodic: { record: vi.fn(), recall: vi.fn() },
      project: { getConventions: vi.fn().mockResolvedValue([]), getArchitecturalDecisions: vi.fn().mockResolvedValue([]) },
      decisions: { record: vi.fn(), search: vi.fn(), recent: vi.fn(), get: vi.fn() },
    },
    llm: {} as any,
    prompts: { build: vi.fn() } as any,
    tracer: { startSpan: vi.fn(), endSpan: vi.fn() },
    artifacts: [],
  }

  return { agent, context }
}

describe('StrategistAgent', () => {
  it('has the correct role', () => {
    const { agent } = mockEnv()
    expect(agent.role).toBe('the-strategist')
  })

  it('produces a structured brief from an ambiguous goal', async () => {
    const { agent, context } = mockEnv()
    const result = await agent.run('fix login on mobile', context)
    expect(result.output).toContain('Problem Statement')
    expect(result.output).toContain('Success Criteria')
  })

  it('delegates to reasoning loop for brief generation', async () => {
    const { agent, context } = mockEnv()
    await agent.run('improve performance', context)
    expect(agent['reasoningLoop'].run).toHaveBeenCalled()
  })

  it('returns system prompt with strategist context', async () => {
    const { agent, context } = mockEnv()
    const prompt = await agent.getSystemPrompt(context)
    expect(prompt).toContain('Strategist')
  })
})
