import { describe, it, expect, vi } from 'vitest'
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
})
