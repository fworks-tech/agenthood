import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ExplainCodeSkill } from '../../../src/skills/code/ExplainCodeSkill.ts'
import { createTestContext } from '../../helpers/testContext.ts'
import type { ExecutionContext } from '../../../src/core/ExecutionContext.ts'

describe('ExplainCodeSkill', () => {
  let skill: ExplainCodeSkill
  let context: ExecutionContext

  beforeEach(() => {
    skill = new ExplainCodeSkill()
    context = createTestContext({
      llm: {
        complete: vi.fn().mockResolvedValue({
          content: 'This function adds two numbers and returns the result.',
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
          model: 'mock-model',
        }),
        stream: vi.fn(),
        embed: vi.fn(),
        getContextWindow: vi.fn().mockReturnValue(8192),
      },
    })
  })

  describe('properties', () => {
    it('has name "explain_code"', () => {
      expect(skill.name).toBe('explain_code')
    })

    it('has description mentioning explain', () => {
      expect(skill.description.toLowerCase()).toContain('explain')
    })

    it('requires "code" in inputSchema', () => {
      expect(skill.inputSchema.required).toContain('code')
    })
  })

  describe('execute() — happy path', () => {
    it('returns LLM explanation for code', async () => {
      const result = await skill.execute({ code: 'function add(a, b) { return a + b }' }, context)

      expect(result.success).toBe(true)
      expect(result.output).toBe('This function adds two numbers and returns the result.')
    })

    it('calls LLM with the code content', async () => {
      const code = 'const x = 42'
      await skill.execute({ code }, context)

      expect(context.llm.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ content: expect.stringContaining(code) }),
          ]),
        }),
      )
    })

    it('includes language hint in prompt when provided', async () => {
      await skill.execute({ code: 'let x = 1', language: 'TypeScript' }, context)

      expect(context.llm.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ content: expect.stringContaining('TypeScript') }),
          ]),
        }),
      )
    })

    it('works without language parameter', async () => {
      const result = await skill.execute({ code: 'x = 1' }, context)
      expect(result.success).toBe(true)
    })
  })

  describe('execute() — error path', () => {
    it('returns error result when LLM fails', async () => {
      context = createTestContext({
        llm: {
          complete: vi.fn().mockRejectedValue(new Error('LLM unavailable')),
          stream: vi.fn(),
          embed: vi.fn(),
          getContextWindow: vi.fn().mockReturnValue(8192),
        },
      })

      const result = await skill.execute({ code: 'const x = 1' }, context)

      expect(result.success).toBe(false)
      expect(result.output).toBe('')
      expect(result.error).toContain('LLM unavailable')
    })

    it('wraps non-Error exceptions', async () => {
      context = createTestContext({
        llm: {
          complete: vi.fn().mockRejectedValue('string error'),
          stream: vi.fn(),
          embed: vi.fn(),
          getContextWindow: vi.fn().mockReturnValue(8192),
        },
      })

      const result = await skill.execute({ code: 'x' }, context)

      expect(result.success).toBe(false)
      expect(result.error).toContain('string error')
    })
  })
})
