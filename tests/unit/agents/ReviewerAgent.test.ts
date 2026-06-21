import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ReviewerAgent } from '../../../src/agents/ReviewerAgent.ts'
import { ReActLoop } from '../../../src/reasoning/ReActLoop.ts'
import { SkillRegistry } from '../../../src/skills/SkillRegistry.ts'
import { createTestContext } from '../../helpers/testContext.ts'
import type { ILLMProvider } from '../../../src/llm/ILLMProvider.ts'

function createMockLLM(): ILLMProvider {
  return {
    complete: vi.fn().mockResolvedValue({
      content: 'mock reviewer output',
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      model: 'mock-model',
    }),
    stream: vi.fn(),
    embed: vi.fn(),
    getContextWindow: vi.fn().mockReturnValue(8192),
  }
}

describe('ReviewerAgent', () => {
  let agent: ReviewerAgent
  let llm: ILLMProvider
  let skillRegistry: SkillRegistry

  beforeEach(() => {
    llm = createMockLLM()
    skillRegistry = new SkillRegistry()
    const loop = new ReActLoop(llm, skillRegistry)
    agent = new ReviewerAgent(llm, loop, skillRegistry)
  })

  describe('properties', () => {
    it('has role "reviewer"', () => {
      expect(agent.role).toBe('reviewer')
    })
  })

  describe('getSystemPrompt()', () => {
    it('uses reviewer.system template', async () => {
      const buildMock = vi.fn().mockReturnValue({ role: 'system' as const, content: 'template' })
      const context = createTestContext({ prompts: { build: buildMock } })

      await (agent as unknown as { getSystemPrompt: (ctx: typeof context) => Promise<string> }).getSystemPrompt(context)

      expect(buildMock).toHaveBeenCalledWith('reviewer.system', expect.objectContaining({
        conventions: expect.any(String),
        archDecisions: expect.any(String),
      }))
    })

    it('includes template content in prompt', async () => {
      const context = createTestContext({
        prompts: {
          build: vi.fn().mockReturnValue({ role: 'system' as const, content: 'REVIEWER_TEMPLATE' }),
        },
      })

      const prompt = await (agent as unknown as { getSystemPrompt: (ctx: typeof context) => Promise<string> }).getSystemPrompt(context)

      expect(prompt).toContain('REVIEWER_TEMPLATE')
    })

    it('does not request stack variable (reviewer does not need it)', async () => {
      const buildMock = vi.fn().mockReturnValue({ role: 'system' as const, content: 'template' })
      const context = createTestContext({ prompts: { build: buildMock } })

      await (agent as unknown as { getSystemPrompt: (ctx: typeof context) => Promise<string> }).getSystemPrompt(context)

      const callArgs = buildMock.mock.calls[0][1] as Record<string, unknown>
      expect(callArgs).not.toHaveProperty('stack')
    })
  })

  describe('run()', () => {
    it('returns AgentResult with role "reviewer"', async () => {
      const context = createTestContext()
      const result = await agent.run('Review src/agents/DeveloperAgent.ts', context)
      expect(result.role).toBe('reviewer')
      expect(typeof result.output).toBe('string')
    })
  })

  describe('skills', () => {
    it('registers read_file and write_file skills', async () => {
      const context = createTestContext()
      await agent.run('test', context)
      expect(skillRegistry.has('read_file')).toBe(true)
      expect(skillRegistry.has('write_file')).toBe(true)
    })

    it('does not register write_code (reviewer is read-only)', async () => {
      const context = createTestContext()
      await agent.run('test', context)
      expect(skillRegistry.has('write_code')).toBe(false)
    })
  })
})
