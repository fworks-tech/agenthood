import { describe, it, expect, vi } from 'vitest'
import { ReActLoop } from '../../../src/reasoning/ReActLoop.js'
import { ThinkingBudget, BudgetExceededError } from '../../../src/reasoning/ThinkingBudget.js'
import { SkillRegistry, SkillNotFoundError } from '../../../src/skills/SkillRegistry.js'
import { createTestContext } from '../../helpers/testContext.js'
import type { ILLMProvider } from '../../../src/llm/ILLMProvider.js'
import type { ISkill } from '../../../src/skills/ISkill.js'

function mockProvider(options?: { toolCalls?: { name: string; args: unknown }[] }): ILLMProvider {
  const calls = options?.toolCalls
  let callIndex = 0

  return {
    complete: vi.fn().mockImplementation(async () => {
      if (calls && callIndex < calls.length) {
        const tc = calls[callIndex++]
        return {
          content: `processing ${tc.name}`,
          toolCalls: [{ id: 'call_1', name: tc.name, args: tc.args }],
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          model: 'mock-model',
        }
      }
      return {
        content: 'final answer',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        model: 'mock-model',
      }
    }),
    stream: vi.fn(),
    embed: vi.fn(),
    getContextWindow: () => 8192,
  }
}

describe('ReActLoop', () => {
  it('single step: LLM returns no tool calls → returns content', async () => {
    const llm = mockProvider()
    const reg = new SkillRegistry()
    const loop = new ReActLoop(llm, reg)
    const ctx = createTestContext()

    const result = await loop.run('system prompt', 'hello', ctx)
    expect(result).toBe('final answer')
  })

  it('multi step: tool call → observe → final answer', async () => {
    const skill: ISkill = {
      name: 'test_tool',
      description: 'A test tool',
      inputSchema: { type: 'object', properties: { input: { type: 'string' } }, required: ['input'] },
      execute: vi.fn().mockResolvedValue({ success: true, output: 'tool result' }),
    }

    const llm = mockProvider({ toolCalls: [{ name: 'test_tool', args: { input: 'data' } }] })
    const reg = new SkillRegistry()
    reg.register(skill)
    const loop = new ReActLoop(llm, reg)
    const ctx = createTestContext()

    const result = await loop.run('system prompt', 'use a tool', ctx)
    expect(result).toBe('final answer')
    expect(skill.execute).toHaveBeenCalledWith({ input: 'data' }, ctx)
  })

  it('budget exceeded: throws BudgetExceededError', async () => {
    const llm = mockProvider({
      toolCalls: Array(15).fill({ name: 'loop_tool', args: {} }),
    })
    const skill: ISkill = {
      name: 'loop_tool',
      description: 'Loops forever',
      inputSchema: { type: 'object', properties: {}, required: [] },
      execute: vi.fn().mockResolvedValue({ success: true, output: 'still going' }),
    }
    const reg = new SkillRegistry()
    reg.register(skill)
    const budget = new ThinkingBudget(3)
    const loop = new ReActLoop(llm, reg, budget)
    const ctx = createTestContext()

    await expect(loop.run('system', 'loop', ctx)).rejects.toThrow(BudgetExceededError)
  })

  it('unknown tool: propagates error message in tool result', async () => {
    const llm = mockProvider({ toolCalls: [{ name: 'unknown_tool', args: {} }] })
    const reg = new SkillRegistry()
    const loop = new ReActLoop(llm, reg)
    const ctx = createTestContext()

    const result = await loop.run('system', 'use unknown tool', ctx)
    expect(result).toBe('final answer')
  })
})
