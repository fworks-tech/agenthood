import { describe, it, expect, vi, beforeAll, beforeEach, afterEach, afterAll } from 'vitest'
import { mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// MEMBERS_DIR is a const resolved from the module's own location — mock the
// module to point it at a temp fixture so the drop guards are testable without
// touching the real packaged tree.
const state = vi.hoisted(() => ({
  dir: '',
  integrity: (() => 'clean') as (...args: unknown[]) => unknown,
}))

vi.mock('../../../src/members/MemberRegistry.ts', () => ({
  MEMBERS_DIR: state.dir,
}))

vi.mock('../../../src/utils/skillIntegrity.ts', () => ({
  checkSkillIntegrity: (...args: unknown[]) => state.integrity(...args),
}))

type SkillDiscoveryType = typeof import('../../../src/skills/discovery/SkillDiscovery.ts')['SkillDiscovery']
let SkillDiscovery: SkillDiscoveryType
let fixtureDir: string

function writeSkill(dir: string, name: string, frontmatter: string): void {
  mkdirSync(join(dir, name), { recursive: true })
  writeFileSync(join(dir, name, 'SKILL.md'), `---\n${frontmatter}\n---\n# Overview\nbody`)
}

beforeAll(async () => {
  const outsideDir = join(tmpdir(), `agenthood-packaged-outside-${Date.now()}`)
  writeSkill(outsideDir, 'outside-skill', 'name: link-target\ndescription: symlink source outside the packaged tree')
  fixtureDir = join(tmpdir(), `agenthood-packaged-${Date.now()}`)
  writeSkill(fixtureDir, 'good', 'name: good\ndescription: aligned skill')
  writeSkill(fixtureDir, 'mismatch', 'name: other\ndescription: frontmatter name disagrees with dir')
  writeSkill(fixtureDir, 'noname', 'description: no name field at all')
  writeSkill(fixtureDir, 'the-member', 'name: the-member\ndescription: member dir')
  mkdirSync(join(fixtureDir, '_shared'), { recursive: true })
  writeFileSync(join(fixtureDir, '_shared', 'STYLE.md'), 'style fragment')
  symlinkSync(join(outsideDir, 'outside-skill'), join(fixtureDir, 'link'), 'junction')

  state.dir = fixtureDir
  ;({ SkillDiscovery } = await import('../../../src/skills/discovery/SkillDiscovery.ts'))
})

beforeEach(() => {
  state.integrity = vi.fn().mockReturnValue('clean')
})

afterEach(() => {
  vi.restoreAllMocks()
})

afterAll(() => {
  rmSync(fixtureDir, { recursive: true, force: true })
})

describe('discoverPackaged drop guards (mocked MEMBERS_DIR)', () => {
  it('keeps only aligned, non-member, non-symlink packaged skills', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const discovery = new SkillDiscovery(fixtureDir)
    expect(discovery.discoverPackaged().map((m) => m.name)).toEqual(['good'])
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('packaged "mismatch" dropped'))
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('packaged "noname" dropped'))
    warnSpy.mockRestore()
  })

  it('does not fire the lockfile integrity gate for packaged dirs', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const discovery = new SkillDiscovery(fixtureDir)
    discovery.discoverPackaged()
    expect(state.integrity).not.toHaveBeenCalled()
  })
})
