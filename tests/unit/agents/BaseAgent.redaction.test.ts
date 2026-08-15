import { describe, it, expect, vi } from 'vitest'
import { TestAgent, createAgentHarness } from '../../helpers/agentFixtures.ts'
import { createTestContext } from '../../helpers/testContext.ts'
import { RedactionFilter } from '../../../src/core/RedactionFilter.ts'
import { contentHash } from '../../../src/utils/hash.js'

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
