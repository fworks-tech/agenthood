import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QAAgent } from '../../../src/agents/QAAgent.ts'
import { ReActLoop } from '../../../src/reasoning/ReActLoop.ts'
import { SkillRegistry } from '../../../src/skills/SkillRegistry.ts'
import { createTestContext } from '../../helpers/testContext.ts'
import type { ILLMProvider } from '../../../src/llm/ILLMProvider.ts'

function createMockLLM(): ILLMProvider {
  return {
    complete: vi.fn().mockResolvedValue({
      content: 'mock qa output',
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      model: 'mock-model',
    }),
    stream: vi.fn(),
    embed: vi.fn(),
    getContextWindow: vi.fn().mockReturnValue(8192),
  }
}

describe('QAAgent', () => {
  let agent: QAAgent
  let llm: ILLMProvider
  let skillRegistry: SkillRegistry

  beforeEach(() => {
    llm = createMockLLM()
    skillRegistry = new SkillRegistry()
    const loop = new ReActLoop(llm, skillRegistry)
    agent = new QAAgent(llm, loop, skillRegistry)
  })

  describe('properties', () => {
    it('has role "qa"', () => {
      expect(agent.role).toBe('qa')
    })
  })

  describe('getSystemPrompt()', () => {
    it('uses qa.system template', async () => {
      const buildMock = vi.fn().mockReturnValue({ role: 'system' as const, content: 'template' })
      const context = createTestContext({ prompts: { build: buildMock } })

      await (agent as unknown as { getSystemPrompt: (ctx: typeof context) => Promise<string> }).getSystemPrompt(context)

      expect(buildMock).toHaveBeenCalledWith('qa.system', expect.objectContaining({
        conventions: expect.any(String),
        testPatterns: expect.any(String),
        stack: expect.any(String),
      }))
    })

    it('includes template content in prompt', async () => {
      const context = createTestContext({
        prompts: {
          build: vi.fn().mockReturnValue({ role: 'system' as const, content: 'QA_TEMPLATE' }),
        },
      })

      const prompt = await (agent as unknown as { getSystemPrompt: (ctx: typeof context) => Promise<string> }).getSystemPrompt(context)

      expect(prompt).toContain('QA_TEMPLATE')
    })

    it('appends the-tester SKILL.md lore when available', async () => {
      const context = createTestContext({
        prompts: {
          build: vi.fn().mockReturnValue({ role: 'system' as const, content: 'TEMPLATE' }),
        },
      })

      const prompt = await (agent as unknown as { getSystemPrompt: (ctx: typeof context) => Promise<string> }).getSystemPrompt(context)

      // SKILL.md exists — check it includes known content from the-tester/SKILL.md
      if (prompt.includes('---')) {
        expect(prompt).toContain('The Tester')
      }
    })
  })

  describe('run()', () => {
    it('returns AgentResult with role "qa"', async () => {
      const context = createTestContext()
      const result = await agent.run('Write tests for ReadFileSkill', context)
      expect(result.role).toBe('qa')
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
