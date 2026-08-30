import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemberAgent } from '../../../src/members/MemberAgent.ts'
import type { MemberSpec } from '../../../src/members/types.ts'
import { createAgentHarness } from '../../helpers/agentFixtures.ts'
import { createTestContext } from '../../helpers/testContext.ts'
import { MIND_VIRUS_IMMUNITY_WARNING } from '../../../src/agents/memberLore.ts'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { contentHash } from '../../../src/utils/hash.ts'

function makeSpec(overrides: Partial<MemberSpec>): MemberSpec {
  return {
    name: 'the-tester',
    description: 'A test member',
    category: 'engineering',
    tagline: 'tests',
    permissionProfile: 'standard',
    preferredProvider: 'anthropic',
    tools: [],
    systemPrompt: '',
    sourcePath: '/nonexistent/SKILL.md',
    ...overrides,
  }
}

describe('MemberAgent tool construction', () => {
  function toolNames(agent: MemberAgent): string[] {
    return (agent as unknown as { tools: { name: string }[] }).tools.map((t) => t.name)
  }

  it('fails closed with read-only tools when none instantiate', () => {
    const { llm, toolRegistry, loop } = createAgentHarness()
    // tasks.read has no TOOL_MAP entry after the alias cleanup
    const agent = new MemberAgent(makeSpec({ tools: ['tasks.read', 'code.grep'] }), llm, loop, toolRegistry)

    const names = toolNames(agent)
    expect(names).toHaveLength(1)
    expect(names[0]).toBe('read_file')
  })

  it('does not grant delegation to restricted members', () => {
    const { llm, toolRegistry, loop } = createAgentHarness()
    const agent = new MemberAgent(
      makeSpec({ tools: ['file.read'], permissionProfile: 'restricted' }),
      llm, loop, toolRegistry,
      { agentRegistry: {} as never },
    )

    expect(toolNames(agent)).not.toContain('delegate_task')
  })

  it('grants delegation to members that opt in', () => {
    const { llm, toolRegistry, loop } = createAgentHarness()
    const agent = new MemberAgent(
      makeSpec({ tools: ['file.read'], permissionProfile: 'standard', canDelegate: true }),
      llm, loop, toolRegistry,
      { agentRegistry: {} as never },
    )

    expect(toolNames(agent)).toContain('delegate_task')
  })

  it('withholds delegation without the opt-in', () => {
    const { llm, toolRegistry, loop } = createAgentHarness()
    const agent = new MemberAgent(
      makeSpec({ tools: ['file.read'], permissionProfile: 'standard' }),
      llm, loop, toolRegistry,
      { agentRegistry: {} as never },
    )

    expect(toolNames(agent)).not.toContain('delegate_task')
  })

  it('denies write tools to restricted profiles', () => {
    const { llm, toolRegistry, loop } = createAgentHarness()
    const agent = new MemberAgent(
      makeSpec({ tools: ['file.write', 'code.write', 'code.refactor'], permissionProfile: 'restricted' }),
      llm, loop, toolRegistry,
    )

    const names = toolNames(agent)
    expect(names).not.toContain('write_file')
    expect(names).not.toContain('write_code')
    expect(names).not.toContain('refactor')
  })

  it('denies read-only-equivalent tools that an unknown name requests', () => {
    const { llm, toolRegistry, loop } = createAgentHarness()
    // a tool name that is not classified read-only/write/trusted must be denied
    // (fail-closed) for every profile, not silently granted.
    const agent = new MemberAgent(
      makeSpec({ tools: ['db.write', 'config.delete'], permissionProfile: 'trusted' }),
      llm, loop, toolRegistry,
    )
    // fail-closed leaves no instantiable tools; the fallback grants read-only.
    expect(toolNames(agent)).toEqual(['read_file'])
  })

  it('grants write tools to trusted profiles and reserves pr_sync for trusted only', () => {
    const { llm, toolRegistry, loop } = createAgentHarness()
    const trusted = new MemberAgent(
      makeSpec({ tools: ['file.write', 'pr_sync'], permissionProfile: 'trusted' }),
      llm, loop, toolRegistry,
    )
    const trustedNames = toolNames(trusted)
    expect(trustedNames).toContain('write_file')
    expect(trustedNames).toContain('pr_sync')

    const standard = new MemberAgent(
      makeSpec({ tools: ['pr_sync'], permissionProfile: 'standard' }),
      llm, loop, toolRegistry,
    )
    expect(toolNames(standard)).not.toContain('pr_sync')
  })
})

describe('MemberAgent mind-virus immunity warning', () => {
  it('appends the immunity warning to the system prompt sent to the LLM', async () => {
    const { llm, toolRegistry, loop } = createAgentHarness()
    const agent = new MemberAgent(
      makeSpec({ tools: ['file.read'], permissionProfile: 'standard' }),
      llm, loop, toolRegistry,
    )
    const context = createTestContext()

    await agent.run('summarize the codebase', context)

    const args = vi.mocked(llm.complete).mock.calls
    expect(args.length).toBeGreaterThan(0)
    const systemPrompt = args[0][0].messages[0].content
    expect(systemPrompt).toContain(MIND_VIRUS_IMMUNITY_WARNING)
  })

  it('escapes project conventions exactly once in the system prompt', async () => {
    const { llm, toolRegistry, loop } = createAgentHarness()
    const agent = new MemberAgent(
      makeSpec({ tools: ['file.read'], permissionProfile: 'standard' }),
      llm, loop, toolRegistry,
    )
    const context = createTestContext()
    // a convention value that must survive XML escaping as a single entity,
    // not double-escaped into &amp;lt;
    vi.spyOn(context.memory.project, 'getConventions').mockResolvedValue([{ name: 'whitespace', value: '2 spaces' }])
    vi.spyOn(context.memory.project, 'getArchitecturalDecisions').mockResolvedValue(['Use 2 spaces, <not> "instructions" & co.'])

    await agent.run('summarize the codebase', context)

    const args = vi.mocked(llm.complete).mock.calls
    expect(args.length).toBeGreaterThan(0)
    const systemPrompt = args[0][0].messages[0].content
    // escaped once: the literal entity form, never the re-escaped &amp; version
    expect(systemPrompt).toContain('2 spaces')
    expect(systemPrompt).toContain('&lt;not&gt; &quot;instructions&quot; &amp; co.')
    expect(systemPrompt).not.toContain('&amp;lt;not&gt;')
  })
})

describe('MemberAgent SKILL.md integrity check', () => {
  let dir: string
  let cwdSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'agenthood-member-integrity-'))
    mkdirSync(join(dir, '.agenthood'), { recursive: true })
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(dir)
  })

  afterEach(() => {
    cwdSpy.mockRestore()
    rmSync(dir, { recursive: true, force: true })
  })

  function makeAgent(sourcePath: string, options?: { strictSkillIntegrity?: boolean }): MemberAgent {
    const { llm, toolRegistry, loop } = createAgentHarness()
    return new MemberAgent(
      makeSpec({ tools: ['file.read'], permissionProfile: 'standard', sourcePath }),
      llm, loop, toolRegistry,
      options,
    )
  }

  function driftRecord(spy: ReturnType<typeof vi.spyOn>): { member: string } | undefined {
    return spy.mock.calls.map(([e]) => e as { tags: string[]; member: string })
      .find((e) => e.tags.includes('mind-virus'))
  }

  function driftWarns(warnSpy: ReturnType<typeof vi.spyOn>): boolean {
    return warnSpy.mock.calls.some(([m]) => String(m).includes('[skill-integrity]'))
  }

  it('records drift durably and warns (non-strict) without throwing', async () => {
    const skillPath = join(dir, 'SKILL.md')
    writeFileSync(skillPath, '---\nname: the-tester\n---\nCanonical body.', 'utf8')
    writeFileSync(join(dir, 'agenthood.lock'), JSON.stringify({
      version: 1,
      members: { 'the-tester': { version: contentHash('stale body') } },
    }), 'utf8')

    const agent = makeAgent(skillPath)
    const context = createTestContext()
    const spy = vi.spyOn(context.memory.decisions, 'record').mockResolvedValue(undefined)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await agent.run('summarize', context)

    const entry = driftRecord(spy)
    expect(entry).toBeDefined()
    expect(entry?.member).toBe('the-tester')
    expect(driftWarns(warnSpy)).toBe(true)
    warnSpy.mockRestore()
  })

  it('blocks the run under strict mode after recording an audit entry', async () => {
    const skillPath = join(dir, 'SKILL.md')
    writeFileSync(skillPath, '---\nname: the-tester\n---\nCanonical body.', 'utf8')
    writeFileSync(join(dir, 'agenthood.lock'), JSON.stringify({
      version: 1,
      members: { 'the-tester': { version: contentHash('stale body') } },
    }), 'utf8')

    const agent = makeAgent(skillPath, { strictSkillIntegrity: true })
    const context = createTestContext()
    const spy = vi.spyOn(context.memory.decisions, 'record').mockResolvedValue(undefined)

    await expect(agent.run('summarize', context)).rejects.toThrow(/drifted/i)
    expect(driftRecord(spy)).toBeDefined()
  })

  it('is a silent no-op when the lockfile is absent', async () => {
    const skillPath = join(dir, 'SKILL.md')
    writeFileSync(skillPath, '---\nname: the-tester\n---\nCanonical body.', 'utf8')

    const agent = makeAgent(skillPath)
    const context = createTestContext()
    const spy = vi.spyOn(context.memory.decisions, 'record').mockResolvedValue(undefined)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await agent.run('summarize', context)

    expect(driftRecord(spy)).toBeUndefined()
    expect(driftWarns(warnSpy)).toBe(false)
    warnSpy.mockRestore()
  })

  it('warns and records when the lockfile is corrupt (non-strict)', async () => {
    const skillPath = join(dir, 'SKILL.md')
    writeFileSync(skillPath, '---\nname: the-tester\n---\nCanonical body.', 'utf8')
    writeFileSync(join(dir, 'agenthood.lock'), '{ not json', 'utf8')

    const agent = makeAgent(skillPath)
    const context = createTestContext()
    const spy = vi.spyOn(context.memory.decisions, 'record').mockResolvedValue(undefined)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await agent.run('summarize', context)

    expect(driftRecord(spy)).toBeDefined()
    expect(driftWarns(warnSpy)).toBe(true)
    warnSpy.mockRestore()
  })

  it('blocks the run when the lockfile is corrupt under strict mode', async () => {
    const skillPath = join(dir, 'SKILL.md')
    writeFileSync(skillPath, '---\nname: the-tester\n---\nCanonical body.', 'utf8')
    writeFileSync(join(dir, 'agenthood.lock'), '{ not json', 'utf8')

    const agent = makeAgent(skillPath, { strictSkillIntegrity: true })
    const context = createTestContext()
    const spy = vi.spyOn(context.memory.decisions, 'record').mockResolvedValue(undefined)

    await expect(agent.run('summarize', context)).rejects.toThrow(/corrupt/i)
    expect(driftRecord(spy)).toBeDefined()
  })
})
