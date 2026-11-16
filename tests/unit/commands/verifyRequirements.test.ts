import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { reportContribSkills, reportDuplicates, reportSkillRequirements, reportTokenBudgets } from '../../../src/commands/verifySkills.ts'

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

describe('skill token budgets (#615)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  const writeBody = (name: string, body: string, frontmatter = '') => {
    mkdirSync(join(dir, name), { recursive: true })
    writeFileSync(join(dir, name, 'SKILL.md'), `---\nname: ${name}\ndescription: ${name} skill\n${frontmatter}---\n${body}`)
  }

  it('reports a body over the default budget and suggests references/', () => {
    writeBody('long', 'x'.repeat(20_400))
    reportTokenBudgets(dir)
    expect(output()).toContain('over budget')
    expect(output()).toContain('long:')
    expect(output()).toContain('references/')
  })

  it('honours a per-skill token-budget, even below the default', () => {
    writeBody('small', 'x'.repeat(100), 'token-budget: 5\n')
    reportTokenBudgets(dir)
    expect(output()).toContain('small:')
    expect(output()).toContain('> 5')
  })

  it('reports the total and passes a set within budget', () => {
    writeBody('tiny', 'tiny body')
    reportTokenBudgets(dir)
    expect(output()).toContain('within budget')
    expect(output()).toContain('total')
  })
})

describe('cross-location duplicates (#616)', () => {
  let other: string

  beforeEach(() => {
    other = mkdtempSync(join(tmpdir(), 'verify-dedup-'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    rmSync(other, { recursive: true, force: true })
  })

  const put = (root: string, name: string) => {
    mkdirSync(join(root, name), { recursive: true })
    writeFileSync(join(root, name, 'SKILL.md'), `---\nname: ${name}\ndescription: ${name} skill\n---\nBody`)
  }

  it('names every copy and suggests consolidation', () => {
    put(dir, 'shared')
    put(other, 'shared')
    reportDuplicates([
      { path: dir, scope: 'project' },
      { path: other, scope: 'user' },
    ])
    const text = output()
    expect(text).toContain('shared (2 copies)')
    expect(text).toContain('(project)')
    expect(text).toContain('(user)')
    expect(text).toContain('Keep the project copy')
  })

  it('passes when no name appears twice', () => {
    put(dir, 'alpha')
    put(other, 'beta')
    reportDuplicates([
      { path: dir, scope: 'project' },
      { path: other, scope: 'user' },
    ])
    expect(output()).toContain('no duplicate names')
  })
})

describe('third-party members (#154)', () => {
  const contrib = (name: string, frontmatter: string) => {
    const target = join(dir, 'skills', 'contrib', name)
    mkdirSync(target, { recursive: true })
    writeFileSync(join(target, 'SKILL.md'), `---
name: ${name}
description: ${name} skill
${frontmatter}---
Body`)
  }

  it('stays quiet when there is no contrib directory', () => {
    reportContribSkills(dir)
    expect(output()).toBe('')
  })

  it('passes when every contrib skill names an owner and a source', () => {
    contrib('the-good', `metadata:
  author: someone
source_url: https://example.test/skill
`)
    reportContribSkills(dir)
    expect(output()).toContain('named and sourced')
  })

  it('reports a missing owner and a missing source separately', () => {
    contrib('the-bare', '')
    reportContribSkills(dir)
    expect(output()).toContain('metadata.author')
    expect(output()).toContain('source_url')
  })
})
