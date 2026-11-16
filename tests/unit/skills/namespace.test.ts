import { describe, it, expect } from 'vitest'
import {
  formatSkillRef,
  isSkillReference,
  parseSkillRef,
  toRegistryPath,
} from '../../../src/skills/namespace.ts'

describe('parseSkillRef (#593)', () => {
  it('parses owner/name and the @ shortcut', () => {
    expect(parseSkillRef('fworks-tech/reviewer')).toEqual({ owner: 'fworks-tech', name: 'reviewer' })
    expect(parseSkillRef('@fworks-tech/reviewer')).toEqual({ owner: 'fworks-tech', name: 'reviewer' })
  })

  it('parses a bare legacy name without an owner', () => {
    expect(parseSkillRef('reviewer')).toEqual({ name: 'reviewer' })
  })

  it('rejects a malformed owner', () => {
    expect(() => parseSkillRef('FWorks/reviewer')).toThrow(/invalid owner/)
    expect(() => parseSkillRef('fworks_tech/reviewer')).toThrow(/invalid owner/)
  })

  it('rejects a reference with more than one separator', () => {
    expect(() => parseSkillRef('a/b/c')).toThrow(/expected owner\/name/)
  })
})

describe('formatSkillRef (#593)', () => {
  it('round-trips both forms', () => {
    expect(formatSkillRef({ owner: 'acme', name: 'lint' })).toBe('acme/lint')
    expect(formatSkillRef({ name: 'lint' })).toBe('lint')
  })
})

describe('toRegistryPath (#593)', () => {
  it('keeps the slash as a path separator', () => {
    expect(toRegistryPath('@acme/my-skill')).toBe('acme/my-skill')
  })

  it('encodes each segment separately', () => {
    expect(toRegistryPath('acme/a b')).toBe('acme/a%20b')
  })

  it('passes a legacy bare name through', () => {
    expect(toRegistryPath('reviewer')).toBe('reviewer')
  })

  it('refuses a path with more than one separator', () => {
    expect(() => toRegistryPath('a/b/c')).toThrow()
  })
})

describe('isSkillReference (#593)', () => {
  it('accepts owner/name in both forms', () => {
    expect(isSkillReference('acme/lint')).toBe(true)
    expect(isSkillReference('@acme/lint')).toBe(true)
  })

  it('rejects URLs, git addresses, paths and bare names', () => {
    expect(isSkillReference('https://github.com/acme/lint')).toBe(false)
    expect(isSkillReference('git@github.com:acme/lint.git')).toBe(false)
    expect(isSkillReference('./acme/lint')).toBe(false)
    expect(isSkillReference('lint')).toBe(false)
  })
})
