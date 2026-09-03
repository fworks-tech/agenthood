import { describe, it, expect, vi } from 'vitest'

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

function makeRunner(): MemberRunner {
  const runner = new MemberRunner({
    agents: new AgentRegistry(),
    members: new MemberRegistry(),
    episodeLearner: new EpisodeLearner(),
    anomalyDetector: new AnomalyDetector(),
    alertsPath: 'test-alerts.ndjson',
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
