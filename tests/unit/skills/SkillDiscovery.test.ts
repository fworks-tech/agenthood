import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCheckSkillIntegrity = vi.fn().mockReturnValue('clean')

vi.mock('../../../src/utils/skillIntegrity.ts', () => ({
  checkSkillIntegrity: (...args: unknown[]) => mockCheckSkillIntegrity(...args),
}))

vi.mock('../../../src/skills/discovery/SkillParser.ts', () => ({
  SkillParser: class {
    parse = vi.fn().mockReturnValue({ name: 'test-skill', description: 'A test skill', body: 'body' })
    parseRaw = vi.fn().mockReturnValue({ frontmatter: { name: 'test-skill', description: 'A test skill' }, body: 'body' })
    parseTier = vi.fn().mockReturnValue('community')
    parseManifest = vi.fn().mockReturnValue({ name: 'test-skill', description: 'A test skill', tier: 'community', location: '/test', directory: '/test', body: 'body', resources: [] })
    validateSpec = vi.fn().mockReturnValue([])
  },
}))

import { SkillDiscovery } from '../../../src/skills/discovery/SkillDiscovery.ts'

describe('SkillDiscovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckSkillIntegrity.mockReturnValue('clean')
  })

  it('verifies skill integrity when loading', () => {
    const discovery = new SkillDiscovery('/test')
    discovery.discover('/test')
    expect(mockCheckSkillIntegrity).toHaveBeenCalled()
  })

  it('warns on integrity drift', () => {
    mockCheckSkillIntegrity.mockReturnValue('drift')
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const discovery = new SkillDiscovery('/test')
    discovery.discover('/test')
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('drift'))
    warnSpy.mockRestore()
  })

  it('does not warn on clean status', () => {
    mockCheckSkillIntegrity.mockReturnValue('clean')
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const discovery = new SkillDiscovery('/test')
    discovery.discover('/test')
    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
