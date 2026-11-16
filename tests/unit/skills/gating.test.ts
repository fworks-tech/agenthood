import { describe, it, expect } from 'vitest'
import { contextFromCompatibility, gateSkills } from '../../../src/skills/discovery/gating.ts'
import type { ISkillManifest } from '../../../src/skills/discovery/ISkillManifest.ts'

const skill = (name: string, extra: Partial<ISkillManifest> = {}): ISkillManifest => ({
  name,
  description: `${name} skill`,
  tier: 'community',
  location: `/skills/${name}/SKILL.md`,
  directory: `/skills/${name}`,
  body: `${name} body`,
  resources: [],
  ...extra,
})

describe('model-targets filtering (#549)', () => {
  it('leaves a skill with no requirements active', () => {
    const gate = gateSkills([skill('a')], { provider: 'openai', model: 'gpt-4o', contextWindow: 128000 })
    expect(gate.active).toEqual(['a'])
    expect(gate.blocked.size).toBe(0)
  })

  it('blocks a provider mismatch with the current model in the reason', () => {
    const gate = gateSkills([skill('a', { modelTargets: { provider: ['anthropic'] } })], {
      provider: 'openai',
      model: 'gpt-4o',
    })
    expect(gate.active).toEqual([])
    expect(gate.blocked.get('a')).toContain('requires provider anthropic')
    expect(gate.blocked.get('a')).toContain('"openai"')
  })

  it('matches the provider case-insensitively', () => {
    const gate = gateSkills([skill('a', { modelTargets: { provider: ['Anthropic'] } })], { provider: 'anthropic' })
    expect(gate.active).toEqual(['a'])
  })

  it('blocks a family mismatch', () => {
    const gate = gateSkills([skill('a', { modelTargets: { family: ['claude'] } })], { model: 'gpt-4o' })
    expect(gate.blocked.get('a')).toContain('targets the claude family')
  })

  it('lets an excluded model win over a matching family', () => {
    const gate = gateSkills([skill('a', { modelTargets: { family: ['claude'], exclude: ['haiku'] } })], {
      model: 'claude-haiku-4',
    })
    expect(gate.blocked.get('a')).toContain('excluded')
  })

  it('blocks a model below the minimum context window', () => {
    const gate = gateSkills([skill('a', { modelTargets: { minTokens: 200000 } })], {
      model: 'gpt-4o',
      contextWindow: 128000,
    })
    expect(gate.blocked.get('a')).toContain('needs 200000 tokens of context')
  })

  it('uses requires.context over model-targets.min-tokens', () => {
    const gate = gateSkills([skill('a', { requires: { context: 300000 }, modelTargets: { minTokens: 1000 } })], {
      contextWindow: 200000,
    })
    expect(gate.blocked.get('a')).toContain('300000')
  })

  it('does not block on a requirement it cannot evaluate', () => {
    const gate = gateSkills([skill('a', { modelTargets: { provider: ['anthropic'], minTokens: 500 } })], {})
    expect(gate.active).toEqual(['a'])
  })

  it('tells the model it may switch, without switching anything', () => {
    const gate = gateSkills([skill('a', { modelTargets: { provider: ['anthropic'] } })], { provider: 'openai' })
    expect(gate.blocked.get('a')).toContain('this run keeps the model it started with')
  })
})

describe('compatibility prose fallback (#553)', () => {
  it('reads a K-style context requirement', () => {
    expect(contextFromCompatibility('Requires 128K+ context, tool use support')).toBe(128000)
  })

  it('reads a token-style context requirement', () => {
    expect(contextFromCompatibility('Needs 200,000 token context')).toBe(200000)
  })

  it('ignores prose without a context figure', () => {
    expect(contextFromCompatibility('Requires tool use support')).toBeUndefined()
  })

  it('does not backtrack quadratically on a long space run', () => {
    expect(contextFromCompatibility(`Requires 128K${' '.repeat(50_000)}x`)).toBeUndefined()
  })

  it('accepts collapsed whitespace between the figure and the word', () => {
    expect(contextFromCompatibility('Requires 128 K +  context')).toBe(128000)
    expect(contextFromCompatibility('Needs 200,000  tokens\ncontext')).toBe(200000)
  })

  it('blocks from prose only when nothing structured declares context', () => {
    const gate = gateSkills([skill('a', { compatibility: 'Requires 128K+ context' })], { contextWindow: 32000 })
    expect(gate.blocked.get('a')).toContain('128000')
    const structured = gateSkills(
      [skill('b', { compatibility: 'Requires 128K+ context', requires: { context: 4000 } })],
      { contextWindow: 32000 },
    )
    expect(structured.active).toEqual(['b'])
  })
})

describe('tool availability (#552, #554)', () => {
  it('blocks when a required tool is missing', () => {
    const gate = gateSkills([skill('a', { requires: { tools: ['bash'] } })], { tools: ['read_file'] })
    expect(gate.blocked.get('a')).toContain('requires tool "bash"')
  })

  it('accepts an exact tool name', () => {
    const gate = gateSkills([skill('a', { requires: { tools: ['bash'] } })], { tools: ['bash', 'read_file'] })
    expect(gate.active).toEqual(['a'])
  })

  it('matches an mcp. prefix against any tool under it', () => {
    const gate = gateSkills([skill('a', { requires: { tools: ['mcp.github'] } })], {
      tools: ['mcp.github.create_issue'],
    })
    expect(gate.active).toEqual(['a'])
  })

  it('warns about an unavailable optional tool instead of blocking', () => {
    const gate = gateSkills([skill('a', { requires: { optionalTools: ['jq'] } })], { tools: [] })
    expect(gate.active).toEqual(['a'])
    expect(gate.warnings.get('a')?.[0]).toContain('optional tool "jq"')
  })

  it('warns instead of blocking when the session tool list is unknown', () => {
    const gate = gateSkills([skill('a', { requires: { tools: ['bash'] } })], {})
    expect(gate.active).toEqual(['a'])
    expect(gate.warnings.get('a')?.[0]).toContain('checked when the skill runs')
  })
})

describe('dependency resolution (#571)', () => {
  it('blocks a skill whose required dependency is not installed', () => {
    const gate = gateSkills([skill('a', { dependencies: { required: ['missing'] } })])
    expect(gate.blocked.get('a')).toContain('"missing", which is not installed')
  })

  it('keeps a skill with a satisfied required dependency active', () => {
    const gate = gateSkills([skill('a', { dependencies: { required: ['b'] } }), skill('b')])
    expect(gate.active).toEqual(['a', 'b'])
  })

  it('blocks transitively when the dependency itself cannot run', () => {
    const gate = gateSkills(
      [skill('a', { dependencies: { required: ['b'] } }), skill('b', { modelTargets: { provider: ['anthropic'] } })],
      { provider: 'openai' },
    )
    expect(gate.blocked.get('b')).toContain('provider anthropic')
    expect(gate.blocked.get('a')).toContain('requires "b", which cannot run here')
  })

  it('blocks every skill in a dependency cycle and names the path', () => {
    const gate = gateSkills([
      skill('a', { dependencies: { required: ['b'] } }),
      skill('b', { dependencies: { required: ['a'] } }),
    ])
    expect(gate.active).toEqual([])
    expect(gate.blocked.get('a')).toContain('dependency cycle')
    expect(gate.blocked.get('a')).toContain('a → b → a')
    expect(gate.blocked.has('b')).toBe(true)
  })

  it('warns about an unavailable optional dependency without blocking', () => {
    const gate = gateSkills([skill('a', { dependencies: { optional: ['test-runner'] } })])
    expect(gate.active).toEqual(['a'])
    expect(gate.warnings.get('a')?.[0]).toContain('optional dependency "test-runner"')
  })

  it('resolves a long chain without recursing forever', () => {
    const chain = Array.from({ length: 50 }, (_, i) =>
      skill(`s${i}`, i === 49 ? {} : { dependencies: { required: [`s${i + 1}`] } }),
    )
    const gate = gateSkills(chain)
    expect(gate.blocked.size).toBe(0)
    expect(gate.active).toHaveLength(50)
  })
})
