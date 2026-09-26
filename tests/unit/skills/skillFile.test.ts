import { describe, it, expect, vi, afterEach } from 'vitest'

const existsBySuffix = vi.fn((p: string) => false)

vi.mock('node:fs', () => ({
  existsSync: (p: string) => existsBySuffix(p),
}))

import { resolveSkillFile } from '../../../src/skills/discovery/skillFile.ts'

afterEach(() => {
  existsBySuffix.mockReset()
})

describe('resolveSkillFile', () => {
  it('prefers SKILL.md when both casings exist', () => {
    existsBySuffix.mockImplementation(() => true)
    const resolved = resolveSkillFile('/skills/x')
    expect(resolved?.fileName).toBe('SKILL.md')
    expect(resolved?.nonCanonical).toBe(false)
  })

  it('falls back to skill.md when only lowercase exists', () => {
    existsBySuffix.mockImplementation((p: string) => p.endsWith('skill.md') && !p.endsWith('SKILL.md'))
    const resolved = resolveSkillFile('/skills/x')
    expect(resolved?.fileName).toBe('skill.md')
    expect(resolved?.nonCanonical).toBe(true)
  })

  it('returns undefined when neither exists', () => {
    existsBySuffix.mockImplementation(() => false)
    expect(resolveSkillFile('/skills/x')).toBeUndefined()
  })
})
