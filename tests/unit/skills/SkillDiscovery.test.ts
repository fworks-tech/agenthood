import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

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
})
