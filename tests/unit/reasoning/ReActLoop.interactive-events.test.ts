import { describe, it, expect, vi } from 'vitest'
import { ReActLoop } from '../../../src/reasoning/ReActLoop.ts'
import { ToolRegistry } from '../../../src/tools/ToolRegistry.ts'
import { createTestContext } from '../../helpers/testContext.ts'
import type { RunEvent } from '../../../src/core/RunEventBus.ts'
import type { ILLMProvider } from '../../../src/llm/ILLMProvider.ts'

const { answerRef } = vi.hoisted(() => ({ answerRef: { answer: 'y' } }))
vi.mock('node:readline', () => ({
  createInterface: () => ({
    question: (_: string, cb: (a: string) => void) => cb(answerRef.answer),
    close: () => {},
  }),
}))

function provider(): ILLMProvider {
  return {
    complete: vi
      .fn()
      .mockResolvedValueOnce({
        content: 'calling',
        toolCalls: [{ id: 'c1', name: 'noop', args: { x: 1 } }],
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        model: 'm',
      })
      .mockResolvedValueOnce({
        content: 'done',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        model: 'm',
      }),
    stream: vi.fn(),
    embed: vi.fn().mockResolvedValue([]),
    getContextWindow: () => 8192,
    setModel: vi.fn(),
  } as unknown as ILLMProvider
}

async function runInteractive(answer: string): Promise<RunEvent[]> {
  answerRef.answer = answer
  const context = createTestContext()
  const events: RunEvent[] = []
  context.events.subscribe((e) => events.push(e))
  const loop = new ReActLoop(provider(), new ToolRegistry(), { interactive: true })
  await loop.run('sys', 'task', context)
  return events
}

describe('ReActLoop interactive tool events (#748)', () => {
  it('emits exactly one tool.called and a distinct tool.approval when approved', async () => {
    const events = await runInteractive('y')
    const called = events.filter((e) => e.type === 'tool.called')
    const approval = events.filter((e) => e.type === 'tool.approval')

    expect(called).toHaveLength(1)
    expect(approval).toHaveLength(1)
    expect(approval[0]).toMatchObject({ type: 'tool.approval', name: 'noop', approved: true })
    // the human decision must not masquerade as a second tool call
    expect(called[0]).toMatchObject({ type: 'tool.called', name: 'noop' })
    expect('approved' in called[0]).toBe(false)
  })

  it('emits one tool.called, a rejected approval, and no tool.result when declined', async () => {
    const events = await runInteractive('n')
    expect(events.filter((e) => e.type === 'tool.called')).toHaveLength(1)
    const approval = events.filter((e) => e.type === 'tool.approval')
    expect(approval).toHaveLength(1)
    expect(approval[0]).toMatchObject({ type: 'tool.approval', approved: false })
    expect(events.filter((e) => e.type === 'tool.result')).toHaveLength(0)
  })
})
