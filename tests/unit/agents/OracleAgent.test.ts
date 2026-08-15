import { describe, it, expect, vi } from 'vitest'
import { OracleAgent } from '../../../src/agents/OracleAgent.js'
import { ReActLoop } from '../../../src/reasoning/ReActLoop.js'
import { ToolRegistry } from '../../../src/tools/ToolRegistry.js'
import type { ExecutionContext } from '../../../src/core/ExecutionContext.js'

const captureException = vi.fn()

vi.mock('@sentry/node', () => ({
  init: vi.fn(),
  captureException,
}))

function mockComplete(agent: OracleAgent): ReturnType<typeof vi.fn> {
  return vi.mocked(agent.llm.complete)
}

function mockEnv(): { agent: OracleAgent; context: ExecutionContext } {
  const llm = {
    complete: vi.fn().mockResolvedValue({ content: 'The Oracle answers: use LanceDB for vector storage.' }),
    stream: vi.fn(),
    embed: vi.fn(),
    getContextWindow: vi.fn().mockReturnValue(100000),
    setModel: vi.fn(),
  }

  const skillRegistry = new ToolRegistry()
  const loop = new ReActLoop(llm, skillRegistry)
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
      provenance: { track: vi.fn() },
    },
    llm: {} as any,
    prompts: { build: vi.fn() } as any,
    tracer: { startSpan: vi.fn(), endSpan: vi.fn(), record: vi.fn(), getRecent: vi.fn(), getByMember: vi.fn(), getByCorrelationId: vi.fn(), flush: vi.fn().mockResolvedValue(undefined) },
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

  it('emits a trace envelope with cost and quality fields on run', async () => {
    const { agent, context } = mockEnv()
    await agent.run('what is the oath?', context)

    const record = vi.mocked(context.tracer.record)
    expect(record).toHaveBeenCalledOnce()
    const [env] = record.mock.calls[0]
    expect(env.member).toBe('the-oracle')
    expect(env.status).toBe('success')
    expect(env.cost).toBeGreaterThanOrEqual(0)
    expect(env.qualityScore).toBeNull()
    expect(env.input).toContain('oath')
  })

  it('emits an error-status envelope and rethrows when the LLM fails', async () => {
    const { agent, context } = mockEnv()
    mockComplete(agent).mockRejectedValue(
      new Error('provider exploded'),
    )

    await expect(agent.run('what is the oath?', context)).rejects.toThrow('provider exploded')

    const record = vi.mocked(context.tracer.record)
    expect(record).toHaveBeenCalledOnce()
    const [env] = record.mock.calls[0]
    expect(env.status).toBe('error')
  })

  it('reports Oracle failures to Sentry with the role as the model fallback', async () => {
    const { agent, context } = mockEnv()
    context.sentry = { dsn: 'https://public@test.ingest.sentry.io/1' }
    mockComplete(agent).mockRejectedValue(
      new Error('provider exploded'),
    )

    await expect(agent.run('what is the oath?', context)).rejects.toThrow('provider exploded')

    expect(captureException).toHaveBeenCalledTimes(1)
    const [, opts] = captureException.mock.calls[0]
    expect(opts.tags).toMatchObject({ member: 'the-oracle', model: 'the-oracle' })
  })

  it('records the responding model on the trace envelope', async () => {
    const { agent, context } = mockEnv()
    mockComplete(agent).mockResolvedValueOnce(
      { content: 'The Oracle answers.', model: 'claude-sonnet-4' },
    )

    await agent.run('what is the oath?', context)

    const record = vi.mocked(context.tracer.record)
    const [env] = record.mock.calls[0]
    expect(env.model).toBe('claude-sonnet-4')
  })

  it('returns system prompt without errors', async () => {
    const { agent, context } = mockEnv()
    const prompt = await agent.getSystemPrompt(context)
    expect(prompt).toContain('Oracle')
  })
})
