import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return { ...actual, existsSync: vi.fn(() => false) }
})

import { existsSync } from 'node:fs'

describe('list command', () => {
  let output = ''

  beforeEach(() => {
    output = ''
    vi.spyOn(console, 'log').mockImplementation((...args) => {
      output += args.join(' ') + '\n'
    })
    vi.mocked(existsSync).mockReturnValue(false)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('lists all 14 members', async () => {
    const { list } = await import('../../src/commands/list.js')
    await list()
    const members = [
      'the-scribe', 'the-architect', 'the-reviewer', 'the-tester',
      'the-debugger', 'the-auditor', 'the-herald', 'the-librarian',
      'the-doorman', 'the-oracle', 'the-envoy', 'the-sentinel',
      'the-warden', 'the-steward',
    ]
    for (const m of members) {
      expect(output).toContain(m)
    }
  })

  it('shows inactive status when no skill files exist', async () => {
    const { list } = await import('../../src/commands/list.js')
    await list()
    expect(output).toContain('⬜')
    expect(output).not.toContain('✅  active')
  })

  it('shows active for members whose skill file exists', async () => {
    vi.mocked(existsSync).mockImplementation((p) =>
      typeof p === 'string' && p.includes('the-scribe')
    )
    const { list } = await import('../../src/commands/list.js')
    await list()
    expect(output).toMatch(/✅\s{2}/)
    expect(output).toContain('⬜')
  })

  it('prints the Society heading', async () => {
    const { list } = await import('../../src/commands/list.js')
    await list()
    expect(output).toContain('The Society')
  })

  it('includes permission and provider columns', async () => {
    const { list } = await import('../../src/commands/list.js')
    await list()
    expect(output).toContain('Permission')
    expect(output).toContain('Provider')
    expect(output).toContain('anthropic')
    expect(output).toContain('ollama')
    expect(output).toContain('groq')
    expect(output).toContain('standard')
    expect(output).toContain('restricted')
  })
})
