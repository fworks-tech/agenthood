import { describe, it, expect, vi } from 'vitest'
import { MemberRunner } from '../../../src/runtime/MemberRunner.ts'
import { AskHumanSignal } from '../../../src/tools/human/AskHumanSignal.ts'
import type { RunEvent } from '../../../src/core/RunEventBus.ts'
import { LLMRouter } from '../../../src/llm/LLMRouter.ts'
import type { ILLMProvider } from '../../../src/llm/ILLMProvider.ts'
import type { MemberRegistry } from '../../../src/members/MemberRegistry.ts'
import type { MemberSpec } from '../../../src/members/types.ts'
import type { AgentRegistry } from '../../../src/core/AgentRegistry.ts'
import type { EpisodeLearner } from '../../../src/evals/EpisodeLearner.ts'
import type { AnomalyDetector } from '../../../src/core/AnomalyDetector.ts'
import { createTestContext } from '../../helpers/testContext.ts'

vi.mock('../../../src/llm/LLMRouter.ts', () => ({
  LLMRouter: { createForMember: vi.fn() },
}))

const spec: MemberSpec = {
  name: 'the-tester',
  description: 'test member',
  category: 'validation',
  tagline: 'tests',
  permissionProfile: 'restricted',
  preferredProvider: 'ollama',
  tools: [],
  systemPrompt: 'You are a test member.',
  sourcePath: 'test',
}

function mockLlm(): { llm: ILLMProvider; seenTools: Array<{ name: string }> } {
  const seenTools: Array<{ name: string }> = []
  const llm = {
    complete: vi.fn().mockImplementation(async (request: { tools?: Array<{ name: string }> }) => {
      seenTools.push(...(request.tools ?? []))
      return {
        content: 'blocked on a human decision',
        toolCalls: [{ id: 'call_1', name: 'ask_human', args: { questions: [{ label: 'Ship it?' }] } }],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        model: 'mock-model',
      }
    }),
    stream: vi.fn(),
    embed: vi.fn(),
    getContextWindow: () => 8192,
    setModel: vi.fn(),
  } as unknown as ILLMProvider
  return { llm, seenTools }
}

function runnerWithPark() {
  const { llm, seenTools } = mockLlm()
  vi.mocked(LLMRouter.createForMember).mockResolvedValue(llm)
  const runner = new MemberRunner({
    agents: {} as unknown as AgentRegistry,
    members: { has: () => true, get: () => spec } as unknown as MemberRegistry,
    episodeLearner: { learn: async () => {}, record: async () => {} } as unknown as EpisodeLearner,
    anomalyDetector: { evaluate: () => [] } as unknown as AnomalyDetector,
    alertsPath: 'test-alerts.json',
  })
  const ctx = createTestContext()
  runner.ctx = ctx
  const seen: RunEvent[] = []
  ctx.events.subscribe((e) => seen.push(e))
  return { runner, ctx, seen, seenTools }
}

describe('MemberRunner park', () => {
  it('ask_human reaches the model, parks with run.awaiting_input, and never fails', async () => {
    const { runner, seen, seenTools } = runnerWithPark()

    const err = await runner.runMemberTask('the-tester', 'decide', {}).catch((e) => e)

    expect(err).toBeInstanceOf(AskHumanSignal)
    expect(err.questions).toEqual({ questions: [{ label: 'Ship it?' }] })
    // the bypass registration reaches the model even for a restricted member
    expect(seenTools.some((t) => t.name === 'ask_human')).toBe(true)
    // park is not failure: awaiting_input instead of failed, no tool.result
    expect(seen.map((e) => e.type)).toEqual([
      'run.started',
      'reasoning',
      'tool.called',
      'decision.recorded',
      'provenance.recorded',
      'run.awaiting_input',
    ])
    const parked = seen.find((e) => e.type === 'run.awaiting_input')
    expect(parked).toMatchObject({ member: 'the-tester', question: { questions: [{ label: 'Ship it?' }] } })
  })
})
