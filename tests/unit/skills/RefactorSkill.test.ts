import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RefactorSkill } from '../../../src/skills/code/RefactorSkill.ts'
import { createTestContext } from '../../helpers/testContext.ts'
import type { ExecutionContext } from '../../../src/core/ExecutionContext.ts'
import * as fsPromises from 'node:fs/promises'

vi.mock('node:fs/promises', async (importOriginal) => {
  const real = await importOriginal<typeof fsPromises>()
  return {
    ...real,
    readFile: vi.fn(),
    writeFile: vi.fn(),
    lstat: vi.fn(),
    realpath: vi.fn(),
  }
})

describe('RefactorSkill', () => {
  let skill: RefactorSkill
  let context: ExecutionContext

  beforeEach(() => {
    skill = new RefactorSkill()
    context = createTestContext({
      llm: {
        complete: vi.fn().mockResolvedValue({
          content: 'const x = 1\n',
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
          model: 'mock-model',
        }),
        stream: vi.fn(),
        embed: vi.fn(),
        getContextWindow: vi.fn().mockReturnValue(8192),
      },
    })

    vi.mocked(fsPromises.lstat).mockRejectedValue(new Error('ENOENT'))
    vi.mocked(fsPromises.readFile).mockResolvedValue('const x=1\n' as unknown as Buffer)
    vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('properties', () => {
    it('has name "refactor"', () => {
      expect(skill.name).toBe('refactor')
    })

    it('requires "path" and "goal"', () => {
      expect(skill.inputSchema.required).toContain('path')
      expect(skill.inputSchema.required).toContain('goal')
    })
  })

  describe('execute() — happy path', () => {
    it('reads file, calls LLM, writes result, returns output', async () => {
      const result = await skill.execute(
        { path: 'src/foo.ts', goal: 'extract helper function' },
        context,
      )

      expect(vi.mocked(fsPromises.readFile)).toHaveBeenCalled()
      expect(context.llm.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ content: expect.stringContaining('extract helper function') }),
          ]),
        }),
      )
      expect(vi.mocked(fsPromises.writeFile)).toHaveBeenCalled()
      expect(result.success).toBe(true)
      expect(result.output).toBe('const x = 1\n')
    })

    it('includes original file content in LLM prompt', async () => {
      vi.mocked(fsPromises.readFile).mockResolvedValue('original code' as unknown as Buffer)

      await skill.execute({ path: 'src/x.ts', goal: 'simplify' }, context)

      expect(context.llm.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ content: expect.stringContaining('original code') }),
          ]),
        }),
      )
    })
  })

  describe('execute() — error paths', () => {
    it('returns error when file cannot be read', async () => {
      vi.mocked(fsPromises.readFile).mockRejectedValue(new Error('ENOENT: no such file'))

      const result = await skill.execute({ path: 'src/missing.ts', goal: 'refactor' }, context)

      expect(result.success).toBe(false)
      expect(result.error).toContain('ENOENT')
    })

    it('returns error when LLM fails', async () => {
      context = createTestContext({
        llm: {
          complete: vi.fn().mockRejectedValue(new Error('LLM timeout')),
          stream: vi.fn(),
          embed: vi.fn(),
          getContextWindow: vi.fn().mockReturnValue(8192),
        },
      })

      const result = await skill.execute({ path: 'src/x.ts', goal: 'refactor' }, context)

      expect(result.success).toBe(false)
      expect(result.error).toContain('LLM timeout')
    })

    it('returns error on path traversal attempt', async () => {
      const result = await skill.execute({ path: '../../etc/passwd', goal: 'refactor' }, context)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Path traversal denied')
    })

    it('returns error when writeFile fails', async () => {
      vi.mocked(fsPromises.writeFile).mockRejectedValue(new Error('EACCES: permission denied'))

      const result = await skill.execute({ path: 'src/x.ts', goal: 'refactor' }, context)

      expect(result.success).toBe(false)
      expect(result.error).toContain('EACCES')
    })
  })
})
