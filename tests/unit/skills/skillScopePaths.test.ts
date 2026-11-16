import { describe, it, expect } from 'vitest'
import { join } from 'node:path'
import { userSkillDirs } from '../../../src/skills/discovery/SkillDiscovery.ts'

describe('user-scope skill directories (#523)', () => {
  const home = join('/home', 'u')

  it('puts XDG_DATA_HOME first, then the XDG default, then the legacy path', () => {
    expect(userSkillDirs(home, { XDG_DATA_HOME: '/data' }, 'linux')).toEqual([
      join('/data', 'agents', 'skills'),
      join(home, '.local', 'share', 'agents', 'skills'),
      join(home, '.agents', 'skills'),
    ])
  })

  it('falls back to the XDG default when the variable is unset', () => {
    expect(userSkillDirs(home, {}, 'linux')).toEqual([
      join(home, '.local', 'share', 'agents', 'skills'),
      join(home, '.agents', 'skills'),
    ])
  })

  it('de-duplicates when XDG_DATA_HOME is the default data home', () => {
    const dirs = userSkillDirs(home, { XDG_DATA_HOME: join(home, '.local', 'share') }, 'linux')
    expect(dirs).toEqual([join(home, '.local', 'share', 'agents', 'skills'), join(home, '.agents', 'skills')])
  })

  it('keeps the legacy path only on Windows', () => {
    expect(userSkillDirs(home, { XDG_DATA_HOME: '/data' }, 'win32')).toEqual([join(home, '.agents', 'skills')])
  })
})
