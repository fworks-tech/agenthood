import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/llm/LLMRouter.ts', () => ({
  LLMRouter: {
    create: vi.fn(),
    createForMember: vi.fn(),
    knownProviders: vi.fn(),
  },
}))

import { MemberRunner } from '../../../src/runtime/MemberRunner.ts'
import { LLMRouter } from '../../../src/llm/LLMRouter.ts'
import { MemberRegistry } from '../../../src/members/MemberRegistry.ts'
import { AgentRegistry } from '../../../src/core/AgentRegistry.ts'
import { AnomalyDetector } from '../../../src/core/AnomalyDetector.ts'
import { EpisodeLearner } from '../../../src/evals/EpisodeLearner.ts'
import { MetricsCollector } from '../../../src/memory/MetricsCollector.ts'
import { AskHumanSignal } from '../../../src/tools/human/AskHumanTool.ts'
import type { RunEvent } from '../../../src/core/RunEventBus.ts'
import type { CheckpointStore } from '../../../src/checkpoint/RunCheckpoint.ts'
import { createTestContext } from '../../helpers/testContext.ts'

function fakeAskHumanProvider(): Record<string, unknown> {
  return {
    complete: vi.fn().mockResolvedValue({
      content: 'need human input',
      toolCalls: [
        { id: 'call_1', name: 'ask_human', args: { question: 'Which region?', context: 'deploy thread' } },
      ],
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      model: 'mock-model',
    }),
    stream: vi.fn(),
    embed: vi.fn(),
    getContextWindow: () => 8192,
    setModel: vi.fn(),
  }
}

function makeRunner(checkpointStore?: CheckpointStore): MemberRunner {
  const runner = new MemberRunner({
    agents: new AgentRegistry(),
    members: new MemberRegistry(),
    episodeLearner: new EpisodeLearner(),
    anomalyDetector: new AnomalyDetector(),
    alertsPath: 'test-alerts.ndjson',
    checkpointStore,
  })
  runner.ctx = createTestContext()
  return runner
}

describe('MemberRunner ask_human park', () => {
  it('emits run.awaiting_input, skips run.failed and failure metrics, and rethrows the signal', async () => {
    vi.mocked(LLMRouter.createForMember).mockResolvedValue(fakeAskHumanProvider() as never)
    const recordSpy = vi.spyOn(MetricsCollector.prototype, 'record')
    const runner = makeRunner()
    const events: RunEvent[] = []
    runner.ctx.events.subscribe((e) => {
      events.push(e)
    })

    try {
      const err = await runner.runMemberTask('the-builder', 'deploy the app', {} as never).catch((e) => e)
      expect(err).toBeInstanceOf(AskHumanSignal)
      expect((err as AskHumanSignal).payload).toEqual({ question: 'Which region?', context: 'deploy thread' })

      const awaiting = events.filter((e) => e.type === 'run.awaiting_input')
      expect(awaiting).toHaveLength(1)
      expect(awaiting[0]).toMatchObject({
        member: 'the-builder',
        question: 'Which region?',
        context: 'deploy thread',
      })
      expect(events.some((e) => e.type === 'run.failed')).toBe(false)
      expect(recordSpy).not.toHaveBeenCalled()
    } finally {
      recordSpy.mockRestore()
    }
  })
})

function fakeCompletingProvider(): Record<string, unknown> {
  return {
    complete: vi.fn().mockResolvedValue({
      content: 'all done',
      toolCalls: [],
      usage: { promptTokens: 3, completionTokens: 2, totalTokens: 5 },
      model: 'mock-model',
    }),
    stream: vi.fn(),
    embed: vi.fn(),
    getContextWindow: () => 8192,
    setModel: vi.fn(),
  }
}

describe('MemberRunner checkpoint store injection', () => {
  it('routes save and updateStatus through the injected CheckpointStore', async () => {
    vi.mocked(LLMRouter.createForMember).mockResolvedValue(fakeCompletingProvider() as never)
    const store: CheckpointStore = { load: vi.fn(), save: vi.fn(), updateStatus: vi.fn() }
    const runner = makeRunner(store)

    await runner.runMemberTask('the-builder', 'ship it', {} as never)

    expect(store.save).toHaveBeenCalledWith(
      expect.objectContaining({ member: 'the-builder', task: 'ship it', status: 'running' }),
    )
    expect(store.updateStatus).toHaveBeenCalledWith(expect.any(String), 'completed')
  })

  it('checkpoints the park step with its dangling ask_human tool call', async () => {
    vi.mocked(LLMRouter.createForMember).mockResolvedValue(fakeAskHumanProvider() as never)
    const store: CheckpointStore = { load: vi.fn(), save: vi.fn(), updateStatus: vi.fn() }
    const runner = makeRunner(store)

    await runner.runMemberTask('the-builder', 'deploy the app', {} as never).catch(() => undefined)

    expect(store.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'assistant',
            toolCalls: expect.arrayContaining([expect.objectContaining({ name: 'ask_human' })]),
          }),
        ]),
      }),
    )
  })
})

describe('MemberRunner resume(seed) parity', () => {
  it('replays checkpoint messages and answers the pending ask_human call with the reply', async () => {
    const provider = fakeCompletingProvider()
    vi.mocked(LLMRouter.createForMember).mockResolvedValue(provider as never)
    const cp = {
      id: 'cp-1',
      member: 'the-builder',
      task: 'deploy the app',
      step: 2,
      messages: [
        { role: 'system' as const, content: 'old system' },
        { role: 'user' as const, content: 'deploy the app' },
        {
          role: 'assistant' as const,
          content: 'need input',
          toolCalls: [{ id: 'call_1', name: 'ask_human', args: { question: 'Which region?' } }],
        },
      ],
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      model: 'mock-model',
      activatedSkills: [],
      status: 'running' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    const store: CheckpointStore = { load: vi.fn().mockReturnValue(cp), save: vi.fn(), updateStatus: vi.fn() }
    const runner = makeRunner(store)

    await runner.runMemberTask('the-builder', 'deploy the app', {} as never, { checkpointId: 'cp-1', reply: 'us-east' })

    const sent: { role: string; content: string; tool_call_id?: string }[] =
      provider.complete.mock.calls[0][0].messages
    expect(store.load).toHaveBeenCalledWith('cp-1')
    expect(sent[0].role).toBe('system')
    expect(sent.some((m) => m.role === 'user' && m.content.includes('deploy the app'))).toBe(true)
    expect(sent).toContainEqual(
      expect.objectContaining({ role: 'tool', content: 'us-east', tool_call_id: 'call_1' }),
    )
  })

  it('bare resumeFrom keeps a dangling ask_human call provider-valid', async () => {
    const provider = fakeCompletingProvider()
    vi.mocked(LLMRouter.createForMember).mockResolvedValue(provider as never)
    const cp = {
      id: 'cp-2',
      member: 'the-builder',
      task: 'deploy the app',
      step: 1,
      messages: [
        { role: 'user' as const, content: 'deploy the app' },
        {
          role: 'assistant' as const,
          content: 'need input',
          toolCalls: [{ id: 'call_9', name: 'ask_human', args: { question: 'ok?' } }],
        },
      ],
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      model: 'mock-model',
      activatedSkills: [],
      status: 'running' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    const store: CheckpointStore = { load: vi.fn().mockReturnValue(cp), save: vi.fn(), updateStatus: vi.fn() }
    const runner = makeRunner(store)

    await runner.runMemberTask('the-builder', 'deploy the app', {} as never, 'cp-2')

    const sent = provider.complete.mock.calls[0][0].messages
    expect(sent).toContainEqual(
      expect.objectContaining({ role: 'tool', tool_call_id: 'call_9' }),
    )
  })
})

describe('MemberRunner output_format validation', () => {
  beforeEach(() => {
    vi.mocked(LLMRouter.createForMember).mockResolvedValue(fakeCompletingProvider() as never)
  })

  function runnerWithFormat(output_format: string, mode: 'strict' | 'lenient' = 'lenient'): MemberRunner {
    const runner = makeRunner()
    const spec = { ...runner.deps.members.get('the-builder'), output_format, output_format_mode: mode }
    vi.spyOn(runner.deps.members, 'get').mockReturnValue(spec)
    return runner
  }

  it('does nothing when output matches the declared pattern', async () => {
    const runner = runnerWithFormat('^all done$')
    const { output } = await runner.runMemberTask('the-builder', 'ship it', {} as never)
    expect(output).toBe('all done')
  })

  it('warns and continues in lenient mode on a deviation', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const runner = runnerWithFormat('^## Plan', 'lenient')
      const { output } = await runner.runMemberTask('the-builder', 'ship it', {} as never)
      expect(output).toBe('all done')
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('output_format deviation'))
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('throws OutputFormatError in strict mode on a deviation', async () => {
    const runner = runnerWithFormat('^## Plan', 'strict')
    await expect(runner.runMemberTask('the-builder', 'ship it', {} as never)).rejects.toThrow(/output_format deviation/)
  })
})
