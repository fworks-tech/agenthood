import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { resolveSocietyMembersDir, MEMBER_NAMES } from '../../../src/members.ts'

describe('resolveSocietyMembersDir (#740)', () => {
  it('points at the canonical skills/ dir where member SKILL.md files live', () => {
    expect(existsSync(join(resolveSocietyMembersDir(), 'the-architect', 'SKILL.md'))).toBe(true)
  })

  it('resolves every society member to an on-disk SKILL.md (verify can run on this repo)', () => {
    for (const name of MEMBER_NAMES) {
      expect(existsSync(join(resolveSocietyMembersDir(), name, 'SKILL.md'))).toBe(true)
    }
  })
})
