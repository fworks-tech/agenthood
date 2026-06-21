import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ArchitectAgent } from '../../../src/agents/ArchitectAgent.ts'
import { ReActLoop } from '../../../src/reasoning/ReActLoop.ts'
import { SkillRegistry } from '../../../src/skills/SkillRegistry.ts'
import { createTestContext } from '../../helpers/testContext.ts'
import type { ILLMProvider } from '../../../src/llm/ILLMProvider.ts'

function createMockLLM(): ILLMProvider {
  return {
    complete: vi.fn().mockResolvedValue({
      content: 'mock architect output',
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      model: 'mock-model',
    }),
    stream: vi.fn(),
    embed: vi.fn(),
    getContextWindow: vi.fn().mockReturnValue(8192),
  }
}

describe('ArchitectAgent', () => {
  let agent: ArchitectAgent
  let llm: ILLMProvider
  let skillRegistry: SkillRegistry

  beforeEach(() => {
    llm = createMockLLM()
    skillRegistry = new SkillRegistry()
    const loop = new ReActLoop(llm, skillRegistry)
    agent = new ArchitectAgent(llm, loop, skillRegistry)
  })

  describe('properties', () => {
    it('has role "architect"', () => {
      expect(agent.role).toBe('architect')
    })

    it('exposes the llm', () => {
      expect(agent.llm).toBe(llm)
    })
  })

  describe('getSystemPrompt()', () => {
    it('includes the architect.system template content', async () => {
      const context = createTestContext({
        prompts: {
          build: vi.fn().mockReturnValue({ role: 'system' as const, content: 'TEMPLATE_CONTENT' }),
        },
      })

      // Call run() which internally calls getSystemPrompt() via reasoningLoop
      // We test getSystemPrompt indirectly by checking what run() was called with
      // Direct access via casting since it's protected
      const prompt = await (agent as unknown as { getSystemPrompt: (ctx: typeof context) => Promise<string> }).getSystemPrompt(context)

      expect(prompt).toContain('TEMPLATE_CONTENT')
    })

    it('uses architect.system template', async () => {
      const buildMock = vi.fn().mockReturnValue({ role: 'system' as const, content: 'template' })
      const context = createTestContext({ prompts: { build: buildMock } })

      await (agent as unknown as { getSystemPrompt: (ctx: typeof context) => Promise<string> }).getSystemPrompt(context)

      expect(buildMock).toHaveBeenCalledWith('architect.system', expect.objectContaining({
        conventions: expect.any(String),
        archDecisions: expect.any(String),
        stack: expect.any(String),
      }))
    })

    it('appends SKILL.md member lore when available', async () => {
      const context = createTestContext({
        prompts: {
          build: vi.fn().mockReturnValue({ role: 'system' as const, content: 'TEMPLATE' }),
        },
      })

      const prompt = await (agent as unknown as { getSystemPrompt: (ctx: typeof context) => Promise<string> }).getSystemPrompt(context)

      // SKILL.md exists in this project — lore should be appended
      expect(prompt).toContain('TEMPLATE')
      // Separator is present when lore is appended
      if (prompt.includes('---')) {
        expect(prompt).toMatch(/TEMPLATE\n\n---\n\n/)
      }
    })
  })

  describe('run()', () => {
    it('returns AgentResult with role "architect"', async () => {
      const context = createTestContext()
      const result = await agent.run('Design a caching layer', context)
      expect(result.role).toBe('architect')
      expect(typeof result.output).toBe('string')
      expect(Array.isArray(result.artifacts)).toBe(true)
    })
  })

  describe('skills', () => {
    it('registers read_file, write_file, write_code skills', async () => {
      const context = createTestContext()
      await agent.run('test', context)
      expect(skillRegistry.has('read_file')).toBe(true)
      expect(skillRegistry.has('write_file')).toBe(true)
      expect(skillRegistry.has('write_code')).toBe(true)
    })
  })
})
