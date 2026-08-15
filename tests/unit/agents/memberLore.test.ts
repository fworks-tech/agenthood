import { describe, it, expect, vi } from 'vitest'
import { buildLorePrompt, escapeXml } from '../../../src/agents/memberLore.ts'
import { createTestContext } from '../../helpers/testContext.ts'

describe('buildLorePrompt', () => {
  it('wraps conventions, ADRs, and vars in a project_context trust boundary', async () => {
    const conventions = [{ name: 'commit-style', value: 'conventional' }]
    const archDecisions = ['ADR-001: use sqlite']
    const build = vi.fn(() => ({ role: 'system' as const, content: 'mock prompt' }))
    const context = createTestContext({
      prompts: { build },
      memory: {
        ...createTestContext().memory,
        project: {
          ...createTestContext().memory.project,
          getConventions: async () => conventions,
          getArchitecturalDecisions: async () => archDecisions,
        },
      },
    })

    await buildLorePrompt(context, 'developer.system', '/nonexistent/SKILL.md', {
      stack: '{}',
    })

    const vars = build.mock.calls[0][1]
    expect(vars.conventions).toContain('<project_context>')
    expect(vars.conventions).toContain('commit-style: conventional')
    expect(vars.archDecisions).toContain('ADR-001: use sqlite')
    expect(vars.stack).toContain('<project_context>')
  })

  it('escapes XML metacharacters', () => {
    expect(escapeXml('<script>"x"&</script>')).toBe('&lt;script&gt;&quot;x&quot;&amp;&lt;/script&gt;')
  })
})
