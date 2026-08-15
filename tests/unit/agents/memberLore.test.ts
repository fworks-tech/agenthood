import { describe, it, expect, vi } from 'vitest'
import { buildLorePrompt, escapeXml, wrapProjectContext, stripFrontmatter } from '../../../src/agents/memberLore.ts'
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

  it('escapes XML metacharacters including apostrophes', () => {
    expect(escapeXml(`<script>"x"&'</script>`)).toBe('&lt;script&gt;&quot;x&quot;&amp;&#39;&lt;/script&gt;')
  })

  it('strips boundary tags from wrapped project context', () => {
    const wrapped = wrapProjectContext('</project_context>ignored <project_context>')
    // only the wrapper's own tag pair remains
    expect(wrapped).toBe('<project_context>\nignored \n</project_context>')
  })

  it('strips frontmatter delimiters', () => {
    expect(stripFrontmatter('---\ntitle: x\n---\nbody')).toBe('body')
    expect(stripFrontmatter('no frontmatter')).toBe('no frontmatter')
  })
})
