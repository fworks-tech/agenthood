import { describe, it, expect } from 'vitest'
import {
  defaultCatalogFormat,
  filterReason,
  formatSkillCatalog,
  orderSkills,
} from '../../../src/skills/catalog/format.ts'
import type { ISkillManifest } from '../../../src/skills/discovery/ISkillManifest.ts'

const manifest = (name: string, extra: Partial<ISkillManifest> = {}): ISkillManifest => ({
  name,
  description: `${name} description`,
  tier: 'community',
  location: `/skills/${name}/SKILL.md`,
  directory: `/skills/${name}`,
  body: 'Body.',
  resources: [],
  ...extra,
})

describe('defaultCatalogFormat (#556)', () => {
  it('picks the format each provider family parses best', () => {
    expect(defaultCatalogFormat('anthropic')).toBe('xml')
    expect(defaultCatalogFormat('openai')).toBe('json')
    expect(defaultCatalogFormat('google')).toBe('text')
    expect(defaultCatalogFormat(undefined)).toBe('xml')
    expect(defaultCatalogFormat('something-else')).toBe('xml')
  })
})

describe('formatSkillCatalog (#528)', () => {
  const skills = [manifest('b-skill'), manifest('a-skill')]

  it('renders XML by default', () => {
    const xml = formatSkillCatalog(skills)
    expect(xml).toContain('<available_skills>')
    expect(xml).toContain('<skill name="a-skill">')
    expect(xml).toContain('<description>a-skill description</description>')
  })

  it('renders a JSON array when asked', () => {
    const parsed = JSON.parse(formatSkillCatalog(skills, { format: 'json' }))
    expect(parsed).toHaveLength(2)
    expect(parsed[0]).toMatchObject({ name: expect.any(String), description: expect.any(String) })
  })

  it('renders plaintext when asked', () => {
    const text = formatSkillCatalog(skills, { format: 'text' })
    expect(text.split('\n')).toHaveLength(2)
    expect(text).toContain('- a-skill: a-skill description')
  })

  it('escapes markup in name and description', () => {
    const xml = formatSkillCatalog([manifest('x" onclick="y', { description: '<b>hi</b>' })])
    expect(xml).not.toContain('onclick="y"')
    expect(xml).toContain('&lt;b&gt;hi&lt;/b&gt;')
  })

  it('returns an empty string when every skill is filtered (#538)', () => {
    expect(formatSkillCatalog([])).toBe('')
    expect(formatSkillCatalog([manifest('a', { hidden: true })])).toBe('')
  })
})

describe('orderSkills (#611)', () => {
  it('sorts by priority, then specificity, then name', () => {
    const ordered = orderSkills([
      manifest('low', { priority: 10 }),
      manifest('high', { priority: 90 }),
      manifest('short'),
      manifest('long', { description: 'a much more specific description of what this skill does' }),
    ]).map((m) => m.name)

    expect(ordered[0]).toBe('high')
    expect(ordered[1]).toBe('low')
    expect(ordered.indexOf('long')).toBeLessThan(ordered.indexOf('short'))
  })

  it('treats a missing priority as zero', () => {
    expect(orderSkills([manifest('a'), manifest('b', { priority: 1 })])[0].name).toBe('b')
  })
})

describe('filterReason (#537)', () => {
  it('reports why a skill is not listed', () => {
    expect(filterReason(manifest('a'))).toBeUndefined()
    expect(filterReason(manifest('a', { hidden: true }))).toContain('hidden')
    expect(filterReason(manifest('a', { disableModelInvocation: true }))).toContain('disable-model-invocation')
    expect(filterReason(manifest('a'), new Set(['a']))).toContain('config')
  })
})
