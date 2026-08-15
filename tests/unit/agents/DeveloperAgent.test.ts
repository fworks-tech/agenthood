import { describe, it, expect, vi } from 'vitest'
import { DeveloperAgent } from '../../../src/agents/DeveloperAgent.ts'
import type { AgentRegistry } from '../../../src/core/AgentRegistry.ts'
import { createAgentHarness } from '../../helpers/agentFixtures.ts'

function toolNames(agent: DeveloperAgent): string[] {
  return (agent as unknown as { tools: { name: string }[] }).tools.map((t) => t.name)
}

function makeAgent(delegation: boolean): DeveloperAgent {
  const { llm, toolRegistry, loop } = createAgentHarness()
  const agentRegistry = { has: vi.fn().mockReturnValue(true) } as unknown as AgentRegistry
  return new DeveloperAgent(llm, loop, toolRegistry, { agentRegistry, delegation })
}

describe('DeveloperAgent delegation gating', () => {
  it('grants the delegation tool only when opted in', () => {
    expect(toolNames(makeAgent(true))).toContain('delegate_task')
    expect(toolNames(makeAgent(false))).not.toContain('delegate_task')
  })

  it('keeps the base tool set regardless of the delegation flag', () => {
    for (const delegation of [true, false]) {
      const names = toolNames(makeAgent(delegation))
      expect(names).toEqual(expect.arrayContaining(['read_file', 'write_file', 'write_code', 'refactor', 'search_codebase', 'explain_code']))
    }
  })
})
