import { describe, it, expect } from 'vitest'
import { MemberAgent } from '../../../src/members/MemberAgent.ts'
import type { MemberSpec } from '../../../src/members/types.ts'
import { createAgentHarness } from '../../helpers/agentFixtures.ts'

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
  it('fails closed with read-only tools when none instantiate', () => {
    const { llm, toolRegistry, loop } = createAgentHarness()
    // tasks.read has no TOOL_MAP entry after the alias cleanup
    const agent = new MemberAgent(makeSpec({ tools: ['tasks.read', 'code.grep'] }), llm, loop, toolRegistry)

    const tools = (agent as unknown as { tools: { name: string }[] }).tools
    expect(tools).toHaveLength(1)
    expect(tools[0].name).toBe('read_file')
  })

  it('does not grant delegation to restricted members', () => {
    const { llm, toolRegistry, loop } = createAgentHarness()
    const agent = new MemberAgent(
      makeSpec({ tools: ['file.read'], permissionProfile: 'restricted' }),
      llm, loop, toolRegistry,
      { agentRegistry: {} as never },
    )

    const names = (agent as unknown as { tools: { name: string }[] }).tools.map((t) => t.name)
    expect(names).not.toContain('delegate_task')
  })

  it('grants delegation to members that opt in', () => {
    const { llm, toolRegistry, loop } = createAgentHarness()
    const agent = new MemberAgent(
      makeSpec({ tools: ['file.read'], permissionProfile: 'standard', canDelegate: true }),
      llm, loop, toolRegistry,
      { agentRegistry: {} as never },
    )

    const names = (agent as unknown as { tools: { name: string }[] }).tools.map((t) => t.name)
    expect(names).toContain('delegate_task')
  })

  it('withholds delegation without the opt-in', () => {
    const { llm, toolRegistry, loop } = createAgentHarness()
    const agent = new MemberAgent(
      makeSpec({ tools: ['file.read'], permissionProfile: 'standard' }),
      llm, loop, toolRegistry,
      { agentRegistry: {} as never },
    )

    const names = (agent as unknown as { tools: { name: string }[] }).tools.map((t) => t.name)
    expect(names).not.toContain('delegate_task')
  })
})
