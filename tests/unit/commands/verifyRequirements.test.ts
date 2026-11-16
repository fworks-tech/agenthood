import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { reportSkillRequirements } from '../../../src/commands/verifySkills.ts'

let dir: string

const write = (name: string, frontmatter: string) => {
  mkdirSync(join(dir, name), { recursive: true })
  writeFileSync(join(dir, name, 'SKILL.md'), `---\nname: ${name}\ndescription: ${name} skill\n${frontmatter}---\nBody`)
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'verify-requirements-'))
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  rmSync(dir, { recursive: true, force: true })
})

const output = () => vi.mocked(console.log).mock.calls.flat().join(' ')

describe('skill requirement reports (#549, #551, #552, #554, #571)', () => {
  it('passes a set with no declarations', () => {
    write('plain', '')
    expect(reportSkillRequirements(dir)).toBe(true)
    expect(output()).toContain('no unresolved declarations')
  })

  it('warns about an unknown tool name that is not an mcp. reference', () => {
    write('a', 'requires:\n  tools: [file.read, not_a_tool]\n')
    expect(reportSkillRequirements(dir)).toBe(true)
    expect(output()).toContain('unknown tool "not_a_tool"')
    expect(output()).not.toContain('"file.read"')
  })

  it('warns about a dependency that is not in the set', () => {
    write('a', 'dependencies:\n  required: [ghost]\n')
    expect(reportSkillRequirements(dir)).toBe(true)
    expect(output()).toContain('dependency "ghost" is not a skill in this set')
  })

  it('fails the report on a dependency cycle', () => {
    write('a', 'dependencies:\n  required: [b]\n')
    write('b', 'dependencies:\n  required: [a]\n')
    expect(reportSkillRequirements(dir)).toBe(false)
    expect(output()).toContain('dependency cycle')
  })

  it('warns about a missing, escaping or shadowing variant file', () => {
    write('a', 'metadata:\n  variants:\n    haiku: references/gone.md\n    opus: ../outside.md\n    sonnet: SKILL.md\n')
    expect(reportSkillRequirements(dir)).toBe(true)
    expect(output()).toContain('variant "haiku" file not found')
    expect(output()).toContain('variant "opus" points outside the skill directory')
    expect(output()).toContain('variant "sonnet" shadows the default body')
  })

  it('accepts a variant file that exists inside the directory', () => {
    write('a', 'metadata:\n  variants:\n    haiku: references/compact.md\n')
    mkdirSync(join(dir, 'a', 'references'), { recursive: true })
    writeFileSync(join(dir, 'a', 'references', 'compact.md'), '# compact')
    expect(reportSkillRequirements(dir)).toBe(true)
    expect(output()).not.toContain('variant "haiku"')
  })
})
