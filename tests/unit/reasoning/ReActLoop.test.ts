import { describe, it, expect, vi } from 'vitest'
import { ReActLoop, ToolLoopDetectedError } from '../../../src/reasoning/ReActLoop.js'
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
    setModel: vi.fn(),
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
      toolCalls: Array.from({ length: 15 }, (_, i) => ({ name: 'loop_tool', args: { n: i } })),
    })
    const skill: ISkill = {
      name: 'loop_tool',
      description: 'Loops forever',
      inputSchema: { type: 'object', properties: { n: { type: 'number' } }, required: ['n'] },
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

  it('detects infinite loop: same tool+args repeated within window', async () => {
    const skill: ISkill = {
      name: 'read_file',
      description: 'Reads a file',
      inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
      execute: vi.fn().mockResolvedValue({ success: true, output: 'content' }),
    }

    const llm = mockProvider({
      toolCalls: [
        { name: 'read_file', args: { path: 'foo.txt' } },
        { name: 'read_file', args: { path: 'foo.txt' } },
        { name: 'read_file', args: { path: 'foo.txt' } },
      ],
    })
    const reg = new SkillRegistry()
    reg.register(skill)
    const loop = new ReActLoop(llm, reg, undefined, undefined, 5, 3)
    const ctx = createTestContext()

    await expect(loop.run('system', 'read foo thrice', ctx)).rejects.toThrow(ToolLoopDetectedError)
  })

  it('does not flag different args as a loop', async () => {
    const skill: ISkill = {
      name: 'read_file',
      description: 'Reads a file',
      inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
      execute: vi.fn().mockResolvedValue({ success: true, output: 'content' }),
    }

    const llm = mockProvider({
      toolCalls: [
        { name: 'read_file', args: { path: 'a.txt' } },
        { name: 'read_file', args: { path: 'b.txt' } },
      ],
    })
    const reg = new SkillRegistry()
    reg.register(skill)
    const loop = new ReActLoop(llm, reg)
    const ctx = createTestContext()

    const result = await loop.run('system', 'read two files', ctx)
    expect(result).toBe('final answer')
  })

  it('does not flag same tool+args outside the window', async () => {
    const skill: ISkill = {
      name: 'read_file',
      description: 'Reads a file',
      inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
      execute: vi.fn().mockResolvedValue({ success: true, output: 'content' }),
    }

    const calls = [
      { name: 'read_file', args: { path: 'a.txt' } },
      { name: 'read_file', args: { path: 'b.txt' } },
      { name: 'read_file', args: { path: 'c.txt' } },
      { name: 'read_file', args: { path: 'd.txt' } },
      { name: 'read_file', args: { path: 'a.txt' } },
    ]

    const llm = mockProvider({ toolCalls: calls })
    const reg = new SkillRegistry()
    reg.register(skill)
    const loop = new ReActLoop(llm, reg, undefined, undefined, 3, 3)
    const ctx = createTestContext()

    const result = await loop.run('system', 'read files', ctx)
    expect(result).toBe('final answer')
  })

  it('configurable threshold: threshold=2 catches immediate repeat', async () => {
    const skill: ISkill = {
      name: 'loop_tool',
      description: 'Loops',
      inputSchema: { type: 'object', properties: {}, required: [] },
      execute: vi.fn().mockResolvedValue({ success: true, output: 'still going' }),
    }

    const llm = mockProvider({
      toolCalls: [
        { name: 'loop_tool', args: {} },
        { name: 'loop_tool', args: {} },
      ],
    })
    const reg = new SkillRegistry()
    reg.register(skill)
    const loop = new ReActLoop(llm, reg, undefined, undefined, 5, 2)
    const ctx = createTestContext()

    await expect(loop.run('system', 'loop', ctx)).rejects.toThrow(ToolLoopDetectedError)
  })
})
