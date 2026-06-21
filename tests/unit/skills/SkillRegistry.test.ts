import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { SkillRegistry, SkillNotFoundError } from '../../../src/skills/SkillRegistry.js'
import type { ISkill } from '../../../src/skills/ISkill.js'
import type { ExecutionContext } from '../../../src/core/ExecutionContext.js'

function createMockSkill(name: string): ISkill {
  return {
    name,
    description: `Mock skill ${name}`,
    inputSchema: { type: 'object', properties: {}, required: [] },
    execute: vi.fn().mockResolvedValue({ success: true, output: 'ok' }),
  }
}

describe('SkillRegistry', () => {
  it('register and get return the same skill', () => {
    const reg = new SkillRegistry()
    const skill = createMockSkill('test_skill')
    reg.register(skill)
    expect(reg.get('test_skill')).toBe(skill)
  })

  it('get throws SkillNotFoundError for unknown skill', () => {
    const reg = new SkillRegistry()
    expect(() => reg.get('nonexistent')).toThrow(SkillNotFoundError)
  })

  it('getSchemas returns correct ToolSchema[] shape', () => {
    const reg = new SkillRegistry()
    reg.register(createMockSkill('skill_a'))
    reg.register(createMockSkill('skill_b'))
    const schemas = reg.getSchemas()
    expect(schemas).toHaveLength(2)
    expect(schemas[0]).toHaveProperty('name')
    expect(schemas[0]).toHaveProperty('description')
    expect(schemas[0]).toHaveProperty('inputSchema')
  })

  it('list returns all registered skills in order', () => {
    const reg = new SkillRegistry()
    const a = createMockSkill('a')
    const b = createMockSkill('b')
    reg.register(a)
    reg.register(b)
    expect(reg.list()).toEqual([a, b])
  })

  it('has returns true for registered skill', () => {
    const reg = new SkillRegistry()
    reg.register(createMockSkill('existing'))
    expect(reg.has('existing')).toBe(true)
    expect(reg.has('missing')).toBe(false)
  })

  it('register is idempotent — re-registering overwrites silently', () => {
    const reg = new SkillRegistry()
    reg.register(createMockSkill('dup'))
    reg.register(createMockSkill('dup'))
    expect(reg.list()).toHaveLength(1)
  })

  describe('discover', () => {
    let tmpDir: string

    beforeEach(() => {
      tmpDir = mkdtempSync(join(tmpdir(), 'skill-test-'))
    })

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true })
    })

    it('discovers skills from .js files in a directory', async () => {
      const skillCode = `
        export const testSkill = {
          name: 'discovered_skill',
          description: 'A skill discovered via filesystem scan',
          inputSchema: { type: 'object', properties: {}, required: [] },
          execute: async () => ({ success: true, output: 'ok' }),
        }
      `
      writeFileSync(join(tmpDir, 'test-skill.js'), skillCode)
      const reg = new SkillRegistry()
      const found = await reg.discover(tmpDir)
      expect(found).toHaveLength(1)
      expect(found[0].name).toBe('discovered_skill')
      expect(reg.get('discovered_skill')).toBe(found[0])
    })

    it('discovers skills from nested directories', async () => {
      mkdirSync(join(tmpDir, 'nested'), { recursive: true })
      const skillCode = `
        export const nestedSkill = {
          name: 'nested_skill',
          description: 'A skill in a nested dir',
          inputSchema: { type: 'object', properties: {}, required: [] },
          execute: async () => ({ success: true, output: 'ok' }),
        }
      `
      writeFileSync(join(tmpDir, 'nested', 'nested-skill.js'), skillCode)
      const reg = new SkillRegistry()
      const found = await reg.discover(tmpDir)
      expect(found).toHaveLength(1)
      expect(found[0].name).toBe('nested_skill')
    })

    it('handles empty directory gracefully', async () => {
      const reg = new SkillRegistry()
      const found = await reg.discover(tmpDir)
      expect(found).toHaveLength(0)
    })

    it('handles directory with no skill files gracefully', async () => {
      writeFileSync(join(tmpDir, 'not-a-skill.js'), 'export const x = 42')
      const reg = new SkillRegistry()
      const found = await reg.discover(tmpDir)
      expect(found).toHaveLength(0)
    })

    it('discovers multiple skills from same file', async () => {
      const skillCode = `
        export const skillA = {
          name: 'skill_a',
          description: 'Skill A',
          inputSchema: { type: 'object', properties: {}, required: [] },
          execute: async () => ({ success: true, output: 'ok' }),
        }
        export const skillB = {
          name: 'skill_b',
          description: 'Skill B',
          inputSchema: { type: 'object', properties: {}, required: [] },
          execute: async () => ({ success: true, output: 'ok' }),
        }
      `
      writeFileSync(join(tmpDir, 'multi-skill.js'), skillCode)
      const reg = new SkillRegistry()
      const found = await reg.discover(tmpDir)
      expect(found).toHaveLength(2)
      expect(found.map((f) => f.name).sort()).toEqual(['skill_a', 'skill_b'])
    })

    it('skips hidden directories', async () => {
      mkdirSync(join(tmpDir, '.hidden'), { recursive: true })
      const skillCode = `
        export const hiddenSkill = {
          name: 'hidden_skill',
          description: 'Should not be discovered',
          inputSchema: { type: 'object', properties: {}, required: [] },
          execute: async () => ({ success: true, output: 'ok' }),
        }
      `
      writeFileSync(join(tmpDir, '.hidden', 'hidden.js'), skillCode)
      const reg = new SkillRegistry()
      const found = await reg.discover(tmpDir)
      expect(found).toHaveLength(0)
    })
  })

  describe('watch', () => {
    let tmpDir: string
    let reg: SkillRegistry

    beforeEach(() => {
      tmpDir = mkdtempSync(join(tmpdir(), 'skill-watch-'))
      reg = new SkillRegistry()
    })

    afterEach(() => {
      reg.close()
      rmSync(tmpDir, { recursive: true, force: true })
    })

    it('discovers skills on watch() call', async () => {
      const skillCode = `
        export const watchedSkill = {
          name: 'watched_skill',
          description: 'Found via watch',
          inputSchema: { type: 'object', properties: {}, required: [] },
          execute: async () => ({ success: true, output: 'ok' }),
        }
      `
      writeFileSync(join(tmpDir, 'watched.js'), skillCode)
      await reg.watch(tmpDir)
      expect(reg.has('watched_skill')).toBe(true)
    })

    it('is idempotent — calling watch twice on same dir does not duplicate', async () => {
      const skillCode = `
        export const idempotentSkill = {
          name: 'idempotent_skill',
          description: 'Idempotent',
          inputSchema: { type: 'object', properties: {}, required: [] },
          execute: async () => ({ success: true, output: 'ok' }),
        }
      `
      writeFileSync(join(tmpDir, 'idempotent.js'), skillCode)
      await reg.watch(tmpDir)
      await reg.watch(tmpDir)
      expect(reg.list()).toHaveLength(1)
    })

    it('close() stops watchers', async () => {
      const skillCode = `
        export const closeSkill = {
          name: 'close_skill',
          description: 'Closed',
          inputSchema: { type: 'object', properties: {}, required: [] },
          execute: async () => ({ success: true, output: 'ok' }),
        }
      `
      writeFileSync(join(tmpDir, 'close.js'), skillCode)
      await reg.watch(tmpDir)
      reg.close()
      // Closing should not throw — verified by cleanup in afterEach
      expect(reg.has('close_skill')).toBe(true)
    })
  })
})
