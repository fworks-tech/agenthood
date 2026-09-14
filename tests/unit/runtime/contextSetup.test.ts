import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const mockCheckSkillIntegrity = vi.fn().mockReturnValue('clean')

vi.mock('../../../src/utils/skillIntegrity.ts', () => ({
  checkSkillIntegrity: (...args: unknown[]) => mockCheckSkillIntegrity(...args),
}))

import { SkillDiscovery } from '../../../src/skills/discovery/SkillDiscovery.ts'
import { discoverSkills } from '../../../src/runtime/contextSetup.ts'

describe('discoverSkills packaged merge', () => {
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

  it('catalog lists packaged tool skills alongside project skills', async () => {
    const { catalog, manifests } = await discoverSkills(testDir)
    const packaged = new SkillDiscovery(testDir).discoverPackaged()
    expect(packaged.length).toBeGreaterThan(0)
    for (const m of packaged) {
      expect(manifests.has(m.name)).toBe(true)
      expect(catalog).toContain(`<skill name="${m.name}">`)
    }
    expect(manifests.has('test-skill')).toBe(true)
  })

  it('project skill wins over a packaged skill with the same name', async () => {
    const packagedName = new SkillDiscovery(testDir).discoverPackaged()[0].name
    const overrideDir = join(testDir, '.agents', 'skills', packagedName)
    mkdirSync(overrideDir, { recursive: true })
    writeFileSync(join(overrideDir, 'SKILL.md'), `---\nname: ${packagedName}\ndescription: Project override\n---\n# Overview\nOverride`)

    const { manifests } = await discoverSkills(testDir)
    expect(manifests.get(packagedName)?.directory).toBe(overrideDir)
    expect(manifests.get(packagedName)?.description).toBe('Project override')
  })
})
