import { describe, it, expect } from 'vitest'
import { bumpVersion, setSkillVersion } from '../../../src/commands/bump.ts'

const SKILL = `---
name: scribe
description: Writes things.
license: MIT
metadata:
  version: 1.4.2
  category: docs
---
Body.
`

describe('bumpVersion (#579)', () => {
  it('increments each level and resets the lower ones', () => {
    expect(bumpVersion('1.4.2', 'patch')).toBe('1.4.3')
    expect(bumpVersion('1.4.2', 'minor')).toBe('1.5.0')
    expect(bumpVersion('1.4.2', 'major')).toBe('2.0.0')
  })

  it('drops a pre-release suffix', () => {
    expect(bumpVersion('1.4.2-beta.1', 'patch')).toBe('1.4.3')
  })

  it('rejects a value that is not semver', () => {
    expect(() => bumpVersion('1.4', 'patch')).toThrow()
  })
})

describe('setSkillVersion (#579)', () => {
  it('rewrites only the metadata version line', () => {
    expect(setSkillVersion(SKILL, '1.4.3')).toContain('  version: 1.4.3')
    expect(setSkillVersion(SKILL, '1.4.3')).toContain('  category: docs')
    expect(setSkillVersion(SKILL, '1.4.3').replace('version: 1.4.3', 'version: 1.4.2')).toBe(SKILL)
  })

  it('inserts the key when metadata exists without a version', () => {
    const noVersion = SKILL.replace('  version: 1.4.2\n', '')
    expect(setSkillVersion(noVersion, '0.1.0')).toContain('metadata:\n  version: 0.1.0\n  category: docs')
  })

  it('leaves a nested version key alone', () => {
    const nested = SKILL.replace('  category: docs\n', '  category: docs\n  dependencies:\n    tool:\n      version: 9.9.9\n')
    const next = setSkillVersion(nested, '1.4.3')
    expect(next).toContain('  version: 1.4.3')
    expect(next).toContain('      version: 9.9.9')
  })

  it('refuses a file with no metadata block', () => {
    expect(() => setSkillVersion('---\nname: x\n---\n', '1.0.0')).toThrow()
  })
})
