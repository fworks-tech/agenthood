import { describe, it, expect, beforeEach } from 'vitest'
import { SearchCodebaseSkill } from '../../../src/skills/code/SearchCodebaseSkill.ts'
import { createTestContext } from '../../helpers/testContext.ts'
import type { ExecutionContext } from '../../../src/core/ExecutionContext.ts'

describe('SearchCodebaseSkill', () => {
  let skill: SearchCodebaseSkill
  let context: ExecutionContext

  beforeEach(() => {
    skill = new SearchCodebaseSkill()
    context = createTestContext()
  })

  describe('properties', () => {
    it('has name "search_codebase"', () => {
      expect(skill.name).toBe('search_codebase')
    })

    it('has description mentioning search', () => {
      expect(skill.description.toLowerCase()).toContain('search')
    })

    it('requires "query" in inputSchema', () => {
      expect(skill.inputSchema.required).toContain('query')
    })
  })

  describe('execute() — happy path', () => {
    it('returns matching files for filename query', async () => {
      // The project itself — search for a known file
      const result = await skill.execute({ query: 'SearchCodebaseSkill' }, context)

      expect(result.success).toBe(true)
      expect(result.output).toContain('SearchCodebaseSkill')
    })

    it('returns matching files for content query', async () => {
      const result = await skill.execute({ query: 'class SearchCodebaseSkill' }, context)

      expect(result.success).toBe(true)
      expect(result.output).toContain('SearchCodebaseSkill')
    })

    it('returns multiple results for broad query', async () => {
      const result = await skill.execute({ query: 'import.*vitest' }, context)

      expect(result.success).toBe(true)
      // Should find at least one test file
      expect(result.output.length).toBeGreaterThan(0)
    })

    it('is case-insensitive by default', async () => {
      const result = await skill.execute({ query: 'searchcodebaseskill' }, context)

      expect(result.success).toBe(true)
      expect(result.output).toContain('SearchCodebaseSkill')
    })

    it('handles regex special characters as literal strings', async () => {
      const result = await skill.execute({ query: '(invalid?[regex)' }, context)

      expect(result.success).toBe(true)
      // Invalid regex is treated as literal — should not crash
      expect(typeof result.output).toBe('string')
    })
  })

  describe('execute() — edge cases', () => {
    it('returns "No matches found" for non-existent query', async () => {
      const uniqueId = 'ZZZZNONEXISTENT12345_' + Date.now()
      const result = await skill.execute({ query: uniqueId }, context)

      expect(result.success).toBe(true)
      expect(result.output).toBe('No matches found.')
    })

    it('returns error for empty query', async () => {
      const result = await skill.execute({ query: '' }, context)

      expect(result.success).toBe(false)
      expect(result.error).toContain('empty')
    })

    it('returns error for whitespace-only query', async () => {
      const result = await skill.execute({ query: '   ' }, context)

      expect(result.success).toBe(false)
      expect(result.error).toContain('empty')
    })
  })
})
