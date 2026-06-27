import { describe, it, expect, vi } from 'vitest'
import { OracleAgent } from '../../../src/agents/OracleAgent.js'
import type { ExecutionContext } from '../../../src/core/ExecutionContext.js'

function mockEnv(): { agent: OracleAgent; context: ExecutionContext } {
  const llm = {
    complete: vi.fn().mockResolvedValue({ content: 'The Oracle answers: use LanceDB for vector storage.' }),
    stream: vi.fn(),
    embed: vi.fn(),
    getContextWindow: vi.fn().mockReturnValue(100000),
    setModel: vi.fn(),
  }

  const skillRegistry = { has: vi.fn().mockReturnValue(false), register: vi.fn(), getSchemas: vi.fn().mockReturnValue([]), get: vi.fn(), list: vi.fn() } as any
  const loop = { run: vi.fn() } as any
  const agent = new OracleAgent(llm, loop, skillRegistry)

  const context = {
    executionId: 'test',
    project: { localPath: '/test', name: 'test' },
    memory: {
      shortTerm: { add: vi.fn(), getRecent: vi.fn(), clear: vi.fn() },
      longTerm: { store: vi.fn(), retrieve: vi.fn() },
      episodic: { record: vi.fn(), recall: vi.fn().mockResolvedValue([]) },
      project: { getConventions: vi.fn().mockResolvedValue([]), getArchitecturalDecisions: vi.fn().mockResolvedValue([]) },
      decisions: { record: vi.fn(), search: vi.fn(), recent: vi.fn(), get: vi.fn() },
    },
    llm: {} as any,
    prompts: { build: vi.fn() } as any,
    tracer: { startSpan: vi.fn(), endSpan: vi.fn() },
    artifacts: [],
    oracle: { ask: vi.fn() },
  }

  return { agent, context }
}

describe('OracleAgent', () => {
  it('has the correct role', () => {
    const { agent } = mockEnv()
    expect(agent.role).toBe('the-oracle')
  })

  it('asks a question and returns answer via LLM', async () => {
    const { agent, context } = mockEnv()
    const answer = await agent.ask('what does The Auditor do?', context)
    expect(answer).toContain('Oracle answers')
    expect(answer).toContain('LanceDB')
  })

  it('searches episodic memory during ask', async () => {
    const { agent, context } = mockEnv()
    const recallSpy = vi.mocked(context.memory.episodic.recall)
    recallSpy.mockResolvedValue(['found episode'])

    await agent.ask('find past audits', context)

    expect(recallSpy).toHaveBeenCalledWith('find past audits')
  })

  it('run delegates to ask', async () => {
    const { agent, context } = mockEnv()
    const result = await agent.run('what is the oath?', context)
    expect(result.output).toContain('Oracle answers')
    expect(result.role).toBe('the-oracle')
  })

  it('returns system prompt without errors', async () => {
    const { agent, context } = mockEnv()
    const prompt = await agent.getSystemPrompt(context)
    expect(prompt).toContain('Oracle')
  })
})
