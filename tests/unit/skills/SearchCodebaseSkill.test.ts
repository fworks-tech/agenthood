import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { SearchCodebaseSkill } from '../../../src/tools/code/SearchCodebaseSkill.ts'
import { createTestContext } from '../../helpers/testContext.ts'
import type { ExecutionContext } from '../../../src/core/ExecutionContext.ts'

// Scanning the real repo root made this suite flaky: the walk reads every
// file under cwd() (including the growing untracked .agenthood/ runtime
// state) and cold-cache slow disks blew the 5s default timeout. All tests
// run against this small fixture instead.
let fixtureDir: string

beforeAll(() => {
  fixtureDir = join(tmpdir(), `agenthood-codebase-search-${Date.now()}`)
  mkdirSync(join(fixtureDir, 'src'), { recursive: true })
  writeFileSync(
    join(fixtureDir, 'src', 'SearchCodebaseSkill.ts'),
    'export class SearchCodebaseSkill {\n}\nimport { test } from \'vitest\'\n',
  )
  writeFileSync(
    join(fixtureDir, 'src', 'other.ts'),
    'export const unrelated = 1\n',
  )
})

afterAll(() => {
  rmSync(fixtureDir, { recursive: true, force: true })
})

describe('SearchCodebaseSkill', () => {
  let skill: SearchCodebaseSkill
  let context: ExecutionContext

  beforeEach(() => {
    skill = new SearchCodebaseSkill()
    context = createTestContext({ project: { localPath: fixtureDir, name: 'fixture' } })
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
      const result = await skill.execute({ query: 'SearchCodebaseSkill' }, context)

      expect(result.success).toBe(true)
      expect(result.output).toContain('SearchCodebaseSkill')
    }, 10000)

    it('returns matching files for content query', async () => {
      const result = await skill.execute({ query: 'class SearchCodebaseSkill' }, context)

      expect(result.success).toBe(true)
      expect(result.output).toContain('SearchCodebaseSkill')
    }, 10000)

    it('returns multiple results for broad query', async () => {
      const result = await skill.execute({ query: 'import.*vitest' }, context)

      expect(result.success).toBe(true)
      expect(result.output.length).toBeGreaterThan(0)
    }, 10000)

    it('is case-insensitive by default', async () => {
      const result = await skill.execute({ query: 'searchcodebaseskill' }, context)

      expect(result.success).toBe(true)
      expect(result.output).toContain('SearchCodebaseSkill')
    }, 10000)

    it('handles regex special characters as literal strings', async () => {
      const result = await skill.execute({ query: '(invalid?[regex)' }, context)

      expect(result.success).toBe(true)
      expect(typeof result.output).toBe('string')
    }, 10000)
  })

  describe('execute() — edge cases', () => {
    it('returns "No matches found" for non-existent query', async () => {
      const result = await skill.execute({ query: 'ZZZZNONEXISTENT12345_' }, context)

      expect(result.success).toBe(true)
      expect(result.output).toBe('No matches found.')
    }, 10000)

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
