import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
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
    vi.restoreAllMocks()
    rmSync(testDir, { recursive: true, force: true })
  })

  it('packaged dirs are declared in the npm files allowlist', () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8')) as { files: string[] }
    expect(pkg.files).toContain('skills')
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
    const discovery = new SkillDiscovery(testDir)
    const packagedName = discovery.discoverPackaged().find((m) => m.name === 'docker')?.name
    if (!packagedName) throw new Error('packaged docker skill not found')
    const overrideDir = join(testDir, '.agents', 'skills', packagedName)
    mkdirSync(overrideDir, { recursive: true })
    writeFileSync(join(overrideDir, 'SKILL.md'), `---\nname: ${packagedName}\ndescription: Project override\n---\n# Overview\nOverride`)

    const { manifests } = await discoverSkills(testDir)
    expect(manifests.get(packagedName)?.directory).toBe(overrideDir)
    expect(manifests.get(packagedName)?.description).toBe('Project override')
  })

  it('keeps a hidden skill activatable but out of the catalog (#588)', async () => {
    const hiddenDir = join(testDir, '.agents', 'skills', 'hidden-skill')
    mkdirSync(hiddenDir, { recursive: true })
    writeFileSync(
      join(hiddenDir, 'SKILL.md'),
      '---\nname: hidden-skill\ndescription: Loaded on demand only\nhidden: true\n---\n# Overview\nHidden',
    )

    const { catalog, manifests } = await discoverSkills(testDir)

    expect(manifests.has('hidden-skill')).toBe(true)
    expect(catalog).not.toContain('hidden-skill')
    expect(catalog).toContain('test-skill')
  })

  it('renders JSON for an OpenAI-family provider (#528, #556)', async () => {
    const { catalog } = await discoverSkills(testDir, { provider: 'openai' })
    expect(catalog).toContain('"name": "test-skill"')
    expect(catalog).not.toContain('<available_skills>')
  })

  it('renders plaintext for a Google provider (#556)', async () => {
    const { catalog } = await discoverSkills(testDir, { provider: 'google' })
    expect(catalog).toContain('- test-skill: A test skill')
  })

  it('lets an explicit format override the provider default (#528)', async () => {
    const { catalog } = await discoverSkills(testDir, { provider: 'openai', format: 'xml' })
    expect(catalog).toContain('<available_skills>')
  })

  it('filters a skill disabled in config from the catalog but keeps it activatable (#537)', async () => {
    const { catalog, manifests } = await discoverSkills(testDir, { disabled: ['test-skill'] })
    expect(catalog).not.toContain('name="test-skill"')
    expect(manifests.has('test-skill')).toBe(true)
  })

  it('omits the catalog entirely when nothing is discovered (#538)', async () => {
    vi.spyOn(SkillDiscovery.prototype, 'discover').mockReturnValue([])
    vi.spyOn(SkillDiscovery.prototype, 'discoverPackaged').mockReturnValue([])

    const { catalog, manifests } = await discoverSkills(testDir)

    expect(catalog).toBe('')
    expect(manifests.size).toBe(0)
  })
})
