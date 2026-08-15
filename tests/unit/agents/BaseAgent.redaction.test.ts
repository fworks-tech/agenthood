import { describe, it, expect, vi } from 'vitest'
import { TestAgent, createAgentHarness, createMockLLM } from '../../helpers/agentFixtures.ts'
import { createTestContext } from '../../helpers/testContext.ts'
import { RedactionFilter } from '../../../src/core/RedactionFilter.ts'
import { ReActLoop } from '../../../src/reasoning/ReActLoop.ts'
import { ToolRegistry } from '../../../src/tools/ToolRegistry.ts'
import { contentHash } from '../../../src/utils/hash.ts'

describe('BaseAgent redaction', () => {
  it('redacts decision and provenance payloads when a redactor is configured', async () => {
    const { llm, toolRegistry, loop, mockLongTerm } = createAgentHarness()
    const recordDecision = vi.fn().mockResolvedValue(undefined)
    const trackProvenance = vi.fn().mockResolvedValue(undefined)
    const redactor = new RedactionFilter({ enabled: true })
    const context = createTestContext({
      redactor,
      memory: {
        ...createTestContext().memory,
        longTerm: mockLongTerm,
        decisions: {
          ...createTestContext().memory.decisions,
          record: recordDecision,
        },
        provenance: {
          ...createTestContext().memory.provenance,
          track: trackProvenance,
        },
      },
    })

    const agent = new TestAgent(llm, loop, toolRegistry)
    await agent.run('contact dev@example.com with sk-abc1234567', context)

    const [entry] = recordDecision.mock.calls[0]
    expect(entry.task).toContain('[REDACTED]')
    expect(entry.task).not.toContain('dev@example.com')
    expect(entry.task).not.toContain('sk-abc1234567')

    const [prov] = trackProvenance.mock.calls[0]
    expect(prov.sourceDocument).toContain('[REDACTED]')
    expect(prov.sourceDocument).not.toContain('dev@example.com')
  })

  it('fails closed when the context has no redactor', async () => {
    const { llm, toolRegistry, loop } = createAgentHarness()
    const context = { ...createTestContext(), redactor: undefined } as never

    const agent = new TestAgent(llm, loop, toolRegistry)
    await expect(agent.run('sensitive', context)).rejects.toThrow(/redaction requires a redactor/)
  })

  it('surfaces the original run error instead of the redaction error', async () => {
    const llm = {
      ...createMockLLM(),
      complete: vi.fn().mockRejectedValue(new Error('original boom')),
    }
    const loop = new ReActLoop(llm, new ToolRegistry())
    const context = { ...createTestContext(), redactor: undefined } as never

    const agent = new TestAgent(llm, loop, new ToolRegistry())
    await expect(agent.run('sensitive', context)).rejects.toThrow('original boom')
  })

  it('hashes redacted payloads so inputHash matches the persisted trace text', async () => {
    const { llm, toolRegistry, loop } = createAgentHarness()
    const redactor = new RedactionFilter({ enabled: true })
    const context = createTestContext({ redactor })

    const agent = new TestAgent(llm, loop, toolRegistry)
    await agent.run('email dev@example.com', context)

    const env = context.tracer.getRecent(1)[0]
    expect(env.input).toBe('email [REDACTED]')
    expect(env.inputHash).toBe(contentHash('email [REDACTED]'))
  })
})
