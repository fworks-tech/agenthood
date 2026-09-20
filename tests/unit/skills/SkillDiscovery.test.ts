import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join, sep, basename } from 'node:path'
import { tmpdir } from 'node:os'
import { MEMBERS_DIR } from '../../../src/members/MemberRegistry.ts'

const mockCheckSkillIntegrity = vi.fn().mockReturnValue('clean')

vi.mock('../../../src/utils/skillIntegrity.ts', () => ({
  checkSkillIntegrity: (...args: unknown[]) => mockCheckSkillIntegrity(...args),
}))

import { SkillDiscovery } from '../../../src/skills/discovery/SkillDiscovery.ts'

describe('SkillDiscovery', () => {
  let testDir: string

  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckSkillIntegrity.mockReturnValue('clean')
    testDir = join(tmpdir(), `agenthood-test-${Date.now()}`)
    mkdirSync(join(testDir, '.agents', 'skills', 'test-skill'), { recursive: true })
    writeFileSync(join(testDir, '.agents', 'skills', 'test-skill', 'SKILL.md'), '---\nname: test-skill\ndescription: A test skill\n---\n# Overview\nTest')
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  it('verifies skill integrity when loading', () => {
    const discovery = new SkillDiscovery(testDir)
    discovery.discover(testDir)
    expect(mockCheckSkillIntegrity).toHaveBeenCalled()
  })

  it('warns on integrity drift', () => {
    mockCheckSkillIntegrity.mockReturnValue('drift')
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const discovery = new SkillDiscovery(testDir)
    discovery.discover(testDir)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('drift'))
    warnSpy.mockRestore()
  })

  it('does not warn on clean status', () => {
    mockCheckSkillIntegrity.mockReturnValue('clean')
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const discovery = new SkillDiscovery(testDir)
    discovery.discover(testDir)
    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('discovers skills in bare skills/ directory', () => {
    mkdirSync(join(testDir, 'skills', 'bare-skill'), { recursive: true })
    writeFileSync(join(testDir, 'skills', 'bare-skill', 'SKILL.md'), '---\nname: bare-skill\ndescription: A bare skills dir test\n---\n# Overview\nTest')
    const discovery = new SkillDiscovery(testDir)
    const found = discovery.discover(testDir)
    expect(found.map((m) => m.name)).toContain('bare-skill')
  })

  it('discover() stays project-scoped (no packaged skills leak into publish/verify paths)', () => {
    const discovery = new SkillDiscovery(testDir)
    const found = discovery.discover(testDir)
    expect(found.map((m) => m.name)).toContain('test-skill')
    for (const m of found) {
      expect(m.directory.startsWith(MEMBERS_DIR + sep)).toBe(false)
    }
  })

  describe('discoverPackaged', () => {
    it('lists packaged tool skills with name, description, and body', () => {
      const discovery = new SkillDiscovery(testDir)
      const packaged = discovery.discoverPackaged()
      expect(packaged.length).toBeGreaterThan(0)
      for (const m of packaged) {
        expect(m.name).toBeTruthy()
        expect(m.description).toBeTruthy()
        expect(m.body).toBeTruthy()
      }
    })

    it('excludes member skills and the shared style fragment', () => {
      const discovery = new SkillDiscovery(testDir)
      const names = discovery.discoverPackaged().map((m) => m.name)
      expect(names.filter((n) => n.startsWith('the-'))).toEqual([])
      expect(names).not.toContain('_shared')
    })

    it('skips the integrity gate (packaged tarball is the trust root)', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const discovery = new SkillDiscovery(testDir)
      discovery.discoverPackaged()
      expect(mockCheckSkillIntegrity).not.toHaveBeenCalled()
      expect(warnSpy).not.toHaveBeenCalled()
      warnSpy.mockRestore()
    })

    it('manifest names match their directory entries (no frontmatter-name shadowing)', () => {
      const discovery = new SkillDiscovery(testDir)
      for (const m of discovery.discoverPackaged()) {
        expect(m.name).toBe(basename(m.directory))
      }
    })
  })

  it('discoverRemote seeds discovery once — later get() must not clear the maps', async () => {
    const discovery = new SkillDiscovery(testDir)
    const discoverSpy = vi.spyOn(discovery, 'discover')
    await discovery.discoverRemote([])
    expect(discoverSpy).toHaveBeenCalledTimes(1)
    discovery.get('test-skill')
    expect(discoverSpy).toHaveBeenCalledTimes(1)
  })
})
