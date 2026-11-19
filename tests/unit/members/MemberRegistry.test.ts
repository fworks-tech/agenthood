import { describe, it, expect } from 'vitest'
import { MemberRegistry, MemberNotFoundError, declaresMcpServers } from '../../../src/members/MemberRegistry.ts'

describe('MemberRegistry', () => {
  const registry = new MemberRegistry()

  it('has exactly 20 members', () => {
    expect(registry.list()).toHaveLength(20)
  })

  it('returns correct spec for each known member', () => {
    const names = [
      'scribe', 'architect', 'builder', 'reviewer', 'tester',
      'debugger', 'auditor', 'herald', 'librarian',
      'doorman', 'oracle', 'envoy', 'sentinel',
      'warden', 'steward', 'strategist', 'operator', 'inspector', 'mailman', 'mediator',
    ]
    for (const name of names) {
      const spec = registry.get(name)
      expect(spec.name).toBe(name)
      expect(spec.description).toBeTruthy()
      expect(spec.tagline).toBeTruthy()
      expect(spec.category).toBeTruthy()
      expect(['restricted', 'standard', 'trusted']).toContain(spec.permissionProfile)
      expect(['opencode-go', 'opencode', 'anthropic', 'groq', 'openai', 'ollama']).toContain(spec.preferredProvider)
      expect(Array.isArray(spec.tools)).toBe(true)
      expect(spec.tools.length).toBeGreaterThan(0)
    }
  })

  it('throws MemberNotFoundError for unknown member', () => {
    expect(() => registry.get('unknown-agent')).toThrow(MemberNotFoundError)
  })

  it('has() returns correctly', () => {
    expect(registry.has('scribe')).toBe(true)
    expect(registry.has('reviewer')).toBe(true)
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

    // Total should be 20 (16 original + inspector + mailman + builder + mediator)
    expect(engineering.length + validation.length + knowledge.length + lifecycle.length).toBe(20)
  })

  it('permission profiles match architecture docs', () => {
    const restricted = ['reviewer', 'auditor', 'doorman', 'oracle', 'envoy', 'sentinel', 'warden', 'steward', 'mediator']
    const standard = ['scribe', 'architect', 'builder', 'tester', 'debugger', 'herald', 'librarian', 'inspector']

    for (const name of restricted) {
      expect(registry.get(name).permissionProfile).toBe('restricted')
    }
    for (const name of standard) {
      expect(registry.get(name).permissionProfile).toBe('standard')
    }
  })

  it('every member prefers opencode-go', () => {
    for (const spec of registry.list()) {
      expect(spec.preferredProvider).toBe('opencode-go')
    }
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

describe('custom member registration (#1040)', () => {
  const base = {
    name: 'release-captain',
    description: 'Owns release readiness for one product',
    systemPrompt: 'You are the release captain. Verify the checklist before shipping.',
  }

  it('registers a member visible to has/get/list/listByCategory', () => {
    const registry = new MemberRegistry()
    const spec = registry.register(base)

    expect(spec.name).toBe('release-captain')
    expect(registry.has('release-captain')).toBe(true)
    expect(registry.get('release-captain')).toBe(spec)
    expect(registry.list()).toHaveLength(21)
    expect(registry.list().at(-1)).toBe(spec)
    expect(registry.listByCategory('engineering')).toContainEqual(spec)
  })

  it('applies fail-closed defaults', () => {
    const spec = new MemberRegistry().register(base)

    expect(spec.category).toBe('engineering')
    expect(spec.tagline).toBe(base.description)
    expect(spec.permissionProfile).toBe('restricted')
    expect(spec.canDelegate).toBe(false)
    expect(spec.sourcePath).toBe('custom:release-captain')
    expect(spec.tools).toEqual(['file.read', 'file.search', 'code.explain'])
  })

  it('honors an explicit profile and model', () => {
    const spec = new MemberRegistry().register({
      ...base,
      permissionProfile: 'standard',
      model: 'claude-sonnet-5-5',
      canDelegate: true,
    })

    expect(spec.permissionProfile).toBe('standard')
    expect(spec.model).toBe('claude-sonnet-5-5')
    expect(spec.canDelegate).toBe(true)
    expect(spec.tools).toContain('file.write')
  })

  it('declared tools narrow the profile and never expand it', () => {
    const registry = new MemberRegistry()
    const spec = registry.register({ ...base, tools: ['file.read', 'pr_sync', 'code.write'] })
    expect(spec.tools).toEqual(['file.read'])
  })

  it('an empty tool list yields no tools (fail closed)', () => {
    expect(new MemberRegistry().register({ ...base, tools: [] }).tools).toEqual([])
  })

  it('rejects a built-in name collision', () => {
    expect(() => new MemberRegistry().register({ ...base, name: 'builder' })).toThrow(/collides with an existing member/)
  })

  it('rejects a legacy alias collision', () => {
    expect(() => new MemberRegistry().register({ ...base, name: 'the-scribe' })).toThrow(/collides/)
  })

  it('rejects registering the same name twice', () => {
    const registry = new MemberRegistry()
    registry.register(base)
    expect(() => registry.register(base)).toThrow(/collides/)
  })

  it('rejects invalid slugs', () => {
    const registry = new MemberRegistry()
    for (const name of ['Release Captain', 'a', '-captain', 'CAPTAIN', 'cap_tain', 'has space']) {
      expect(() => registry.register({ ...base, name })).toThrow(/invalid custom member name/)
    }
  })

  it('rejects an empty or oversized system prompt', () => {
    const registry = new MemberRegistry()
    expect(() => registry.register({ ...base, systemPrompt: '   ' })).toThrow(/non-empty systemPrompt/)
    expect(() => registry.register({ ...base, systemPrompt: 'x'.repeat(20_001) })).toThrow(/exceeds 20000/)
  })

  it('rejects an empty description', () => {
    expect(() => new MemberRegistry().register({ ...base, description: ' ' })).toThrow(/non-empty description/)
  })

  it('rejects an oversized description', () => {
    expect(() => new MemberRegistry().register({ ...base, description: 'x'.repeat(501) })).toThrow(/description exceeds 500/)
  })

  it('rejects an unknown permission profile, including prototype keys', () => {
    const registry = new MemberRegistry()
    for (const permissionProfile of ['trusted ', 'admin', 'constructor'] as never[]) {
      expect(() => registry.register({ ...base, permissionProfile })).toThrow(/unknown permissionProfile/)
    }
  })

  it('does not share the profile tool array with the registry', () => {
    const registry = new MemberRegistry()
    const spec = registry.register({ ...base, name: 'isolated-one' })
    spec.tools.push('pr_sync')
    const other = registry.register({ ...base, name: 'isolated-two' })
    expect(other.tools).not.toContain('pr_sync')
    expect(new MemberRegistry().get('reviewer').tools).not.toContain('pr_sync')
  })
})

describe('allowed-tools enforcement (#641)', () => {
  it('intersectDeclaredTools narrows the profile set to declared tools only', () => {
    const result = MemberRegistry.intersectDeclaredTools('file.read code.write', 'restricted')
    expect(result).toEqual(['file.read'])
  })

  it('intersectDeclaredTools never expands beyond the permission profile', () => {
    const result = MemberRegistry.intersectDeclaredTools('file.read file.search code.explain pr_sync', 'restricted')
    expect(result).not.toContain('pr_sync')
    expect(result).toEqual(['file.read', 'file.search', 'code.explain'])
  })

  it('empty declaration yields no profile tools (fail closed)', () => {
    expect(MemberRegistry.intersectDeclaredTools('  ', 'standard')).toEqual([])
  })

  it('member specs carry non-empty tools that stay inside their profile', () => {
    const registry = new MemberRegistry()
    const trusted = new Set(['file.read', 'file.search', 'code.explain', 'ask_human', 'file.write', 'code.write', 'code.refactor', 'pr_sync'])
    for (const spec of registry.list()) {
      expect(spec.tools.length).toBeGreaterThan(0)
      expect(spec.tools.every((t: string) => trusted.has(t))).toBe(true)
    }
  })
})

describe('MCP tool grants (ADR-047)', () => {
  const allowlist = ['mcp.fixture.echo', 'mcp.fixture.add']

  it('drops MCP names without a server grant, even when declared', () => {
    expect(MemberRegistry.intersectDeclaredTools('mcp.fixture.echo file.read', 'standard')).toEqual(['file.read'])
  })

  it('grants a declared server tool only when the server lists it and the profile carries mcp', () => {
    const grants = MemberRegistry.grantsFor('standard', allowlist)
    expect(MemberRegistry.intersectDeclaredTools('mcp.fixture.echo file.read', 'standard', grants))
      .toEqual(['file.read', 'mcp.fixture.echo'])
    expect(MemberRegistry.intersectDeclaredTools('mcp.fixture.nope', 'standard', grants)).toEqual([])
  })

  it('never grants MCP tools to a restricted profile, even with an allowlist', () => {
    const grants = MemberRegistry.grantsFor('restricted', allowlist)
    expect(grants).not.toContain('mcp.fixture.echo')
    expect(MemberRegistry.intersectDeclaredTools('mcp.fixture.echo file.read', 'restricted', grants)).toEqual(['file.read'])
  })

  it('keeps the profile tools unchanged when no server is referenced', () => {
    expect(MemberRegistry.grantsFor('standard')).toEqual(MemberRegistry.grantsFor('standard', []))
    expect(MemberRegistry.intersectDeclaredTools('file.read pr_sync', 'standard', MemberRegistry.grantsFor('standard')))
      .toEqual(['file.read'])
  })

  it('detects an mcpServers key in SKILL.md frontmatter, and only there', () => {
    expect(declaresMcpServers('---\nname: x\nmcpServers:\n  atlas:\n    command: node\n---\nbody')).toBe(true)
    expect(declaresMcpServers('---\nname: x\nallowed-tools: mcp.atlas.search\n---\nmcpServers: in body')).toBe(false)
    expect(declaresMcpServers('---\nname: x\n---\nbody')).toBe(false)
  })

  it('keeps the raw declaration on the spec, so a run can resolve MCP names later', () => {
    const registry = new MemberRegistry()
    const spec = registry.register({
      name: 'mcp-custom',
      description: 'Host member with an MCP tool',
      systemPrompt: 'Use the tool.',
      permissionProfile: 'standard',
      tools: ['mcp.fixture.echo', 'file.read'],
    })
    expect(spec.declaredTools).toEqual(['mcp.fixture.echo', 'file.read'])
    expect(spec.tools).toEqual(['file.read'])
  })
})
