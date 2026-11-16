import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MemberRegistry } from '../../../src/members/MemberRegistry.ts'
import { rawSpecs } from '../../../src/members/member-specs.ts'

const repoRoot = join(import.meta.dirname, '..', '..', '..')

function extractAgentCount(description: string): number | null {
  const match = description.match(/(\d+)\s+specialized agents/)
  return match ? Number.parseInt(match[1], 10) : null
}

describe('package manifest parity', () => {
  const packageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
    description: string
    version: string
  }
  const registryJson = JSON.parse(
    readFileSync(join(repoRoot, 'docs', 'members', 'registry.json'), 'utf8'),
  ) as { members: unknown[] }
  const marketplaceJson = JSON.parse(
    readFileSync(join(repoRoot, '.claude-plugin', 'marketplace.json'), 'utf8'),
  ) as {
    name: string
    owner: { name: string }
    metadata: { description: string; version: string }
    plugins: Array<{ name: string; source: string; strict: boolean; skills: string[] }>
  }

  const registry = new MemberRegistry()
  const registeredCount = registry.list().length
  const rawSpecsCount = rawSpecs.length
  const registryJsonCount = registryJson.members.length
  const marketplaceSkillsCount =
    marketplaceJson.plugins.find((p) => p.name === 'agenthood-all')?.skills.length ?? 0
  const descriptionCount = extractAgentCount(packageJson.description)

  it('package.json description contains a specialized-agents count', () => {
    expect(
      descriptionCount,
      `package.json description should contain "<N> specialized agents": got: ${JSON.stringify(packageJson.description)}`,
    ).not.toBeNull()
  })

  it('description count equals registry length (MemberRegistry)', () => {
    expect(descriptionCount).toBe(registeredCount)
  })

  it('description count equals rawSpecs length', () => {
    expect(descriptionCount).toBe(rawSpecsCount)
  })

  it('description count equals docs/members/registry.json length', () => {
    expect(descriptionCount).toBe(registryJsonCount)
  })

  it('description count equals .claude-plugin/marketplace.json skills length', () => {
    expect(descriptionCount).toBe(marketplaceSkillsCount)
  })

  it('all member sources agree on the same count', () => {
    expect(registeredCount).toBe(rawSpecsCount)
    expect(registeredCount).toBe(registryJsonCount)
    expect(registeredCount).toBe(marketplaceSkillsCount)
    // descriptionCount already checked separately for null, but re-assert equality here
    expect(descriptionCount).toBe(registeredCount)
  })

  it('description literally contains "<N> specialized agents" substring', () => {
    // guards against regex drift: the human-readable string must stay greppable
    expect(packageJson.description).toContain(`${registeredCount} specialized agents`)
  })

  it('fails if description count is off by one (regression guard)', () => {
    // Simulate the previous drift (19 vs 20) to prove the assertion is load-bearing:
    // If registry has 20 but description says 19, the parity must fail.
    const staleDescription = packageJson.description.replace(
      `${registeredCount} specialized agents`,
      `${registeredCount - 1} specialized agents`,
    )
    const staleCount = extractAgentCount(staleDescription)
    expect(staleCount).toBe(registeredCount - 1)
    expect(staleCount).not.toBe(registeredCount)
  })

  it('marketplace metadata.version matches package.json', () => {
    expect(marketplaceJson.metadata.version).toBe(packageJson.version)
  })

  it('marketplace manifest has the required shape and local sources', () => {
    expect(marketplaceJson.name).toBe('agenthood')
    expect(marketplaceJson.owner.name).toBeTruthy()
    expect(marketplaceJson.metadata.description).toBeTruthy()

    const pluginNames = marketplaceJson.plugins.map((plugin) => plugin.name)
    expect(new Set(pluginNames).size).toBe(pluginNames.length)

    for (const plugin of marketplaceJson.plugins) {
      expect(plugin.source).toBe('./')
      expect(typeof plugin.strict).toBe('boolean')
      expect(plugin.skills.length).toBeGreaterThan(0)
      for (const skill of plugin.skills) {
        expect(skill).toMatch(/^\.\/skills\/[a-z0-9-]+$/)
        expect(existsSync(join(repoRoot, skill, 'SKILL.md')), `${skill} is missing SKILL.md`).toBe(true)
      }
    }
  })

  it('agenthood-all bundle lists every registered member', () => {
    const all = marketplaceJson.plugins.find((plugin) => plugin.name === 'agenthood-all')
    if (!all) throw new Error('marketplace.json is missing the agenthood-all plugin')
    const expected = registry.list().map((spec) => `./skills/${spec.name}`)
    expect(new Set(all.skills)).toEqual(new Set(expected))
  })

  it('marketplace manifest has no remote sources or endpoints', () => {
    const raw = readFileSync(join(repoRoot, '.claude-plugin', 'marketplace.json'), 'utf8')
    expect(raw).not.toMatch(/https?:\/\//)
  })
})
