import { describe, it, expect } from 'vitest'
import { MemberRegistry, MemberNotFoundError } from '../../../src/members/MemberRegistry.js'

describe('MemberRegistry', () => {
  const registry = new MemberRegistry()

  it('has exactly 14 members', () => {
    expect(registry.list()).toHaveLength(14)
  })

  it('returns correct spec for each known member', () => {
    const names = [
      'the-scribe', 'the-architect', 'the-reviewer', 'the-tester',
      'the-debugger', 'the-auditor', 'the-herald', 'the-librarian',
      'the-doorman', 'the-oracle', 'the-envoy', 'the-sentinel',
      'the-warden', 'the-steward',
    ]
    for (const name of names) {
      const spec = registry.get(name)
      expect(spec.name).toBe(name)
      expect(spec.description).toBeTruthy()
      expect(spec.tagline).toBeTruthy()
      expect(spec.category).toBeTruthy()
      expect(['restricted', 'standard', 'trusted']).toContain(spec.permissionProfile)
      expect(['anthropic', 'groq', 'openai', 'ollama']).toContain(spec.preferredProvider)
      expect(Array.isArray(spec.tools)).toBe(true)
      expect(spec.tools.length).toBeGreaterThan(0)
    }
  })

  it('throws MemberNotFoundError for unknown member', () => {
    expect(() => registry.get('unknown-agent')).toThrow(MemberNotFoundError)
  })

  it('has() returns correctly', () => {
    expect(registry.has('the-scribe')).toBe(true)
    expect(registry.has('the-reviewer')).toBe(true)
    expect(registry.has('fake-member')).toBe(false)
  })

  it('lists members grouped by category', () => {
    const engineering = registry.listByCategory('engineering')
    const validation = registry.listByCategory('validation')
    const knowledge = registry.listByCategory('knowledge')
    const lifecycle = registry.listByCategory('lifecycle')

    expect(engineering.length).toBeGreaterThanOrEqual(3)
    expect(validation.length).toBeGreaterThanOrEqual(3)
    expect(knowledge.length).toBeGreaterThanOrEqual(1)
    expect(lifecycle.length).toBeGreaterThanOrEqual(1)

    // Total should still be 14
    expect(engineering.length + validation.length + knowledge.length + lifecycle.length).toBe(14)
  })

  it('permission profiles match architecture docs', () => {
    const restricted = ['the-reviewer', 'the-auditor', 'the-doorman', 'the-oracle', 'the-envoy', 'the-sentinel', 'the-warden', 'the-steward']
    const standard = ['the-scribe', 'the-architect', 'the-tester', 'the-debugger', 'the-herald', 'the-librarian']

    for (const name of restricted) {
      expect(registry.get(name).permissionProfile).toBe('restricted')
    }
    for (const name of standard) {
      expect(registry.get(name).permissionProfile).toBe('standard')
    }
  })

  it('preferred providers match architecture docs', () => {
    expect(registry.get('the-scribe').preferredProvider).toBe('anthropic')
    expect(registry.get('the-architect').preferredProvider).toBe('anthropic')
    expect(registry.get('the-reviewer').preferredProvider).toBe('anthropic')
    expect(registry.get('the-doorman').preferredProvider).toBe('ollama')
    expect(registry.get('the-steward').preferredProvider).toBe('groq')
  })

  it('loads system prompt from SKILL.md for each member', () => {
    for (const spec of registry.list()) {
      expect(spec.systemPrompt).toBeTruthy()
      expect(spec.systemPrompt.length).toBeGreaterThan(50) // no empty prompts
    }
  })

  it('source path exists for each member', () => {
    for (const spec of registry.list()) {
      expect(spec.sourcePath).toBeTruthy()
    }
  })
})
