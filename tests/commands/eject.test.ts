import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return { ...actual, rm: vi.fn() }
})

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return { ...actual, existsSync: vi.fn(), readdirSync: vi.fn() }
})

import { rm } from 'node:fs/promises'
import { existsSync, readdirSync } from 'node:fs'

function normalized(rmMock: ReturnType<typeof vi.mocked<typeof rm>>): string[] {
  return rmMock.mock.calls.map((c) => String(c[0]).replace(/\\/g, '/'))
}

describe('eject command', () => {
  let output = ''

  beforeEach(() => {
    output = ''
    vi.spyOn(console, 'log').mockImplementation((...args) => { output += args.join(' ') + '\n' })
    vi.mocked(rm).mockResolvedValue(undefined)
    vi.mocked(rm).mockClear()
    vi.mocked(existsSync).mockClear()
    vi.mocked(readdirSync).mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('removes .agenthood and AGENTS.md', async () => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readdirSync).mockReturnValue([] as never[])
    const { eject } = await import('../../src/commands/eject.js')
    await eject()
    const removed = normalized(vi.mocked(rm))
    expect(removed.some((p) => p.endsWith('.agenthood'))).toBe(true)
    expect(removed.some((p) => p.endsWith('AGENTS.md'))).toBe(true)
  })

  it('removes runtime skills dirs that contain agenthood members', async () => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readdirSync).mockReturnValue(['the-scribe'] as never[])
    const { eject } = await import('../../src/commands/eject.js')
    await eject()
    const removed = normalized(vi.mocked(rm))
    expect(removed.some((p) => p.endsWith('.claude/skills'))).toBe(true)
    expect(removed.some((p) => p.endsWith('.github/skills'))).toBe(true)
    expect(removed.some((p) => p.endsWith('.gemini/skills'))).toBe(true)
  })

  it('leaves foreign skills dirs untouched', async () => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readdirSync).mockReturnValue(['my-custom-skill'] as never[])
    const { eject } = await import('../../src/commands/eject.js')
    await eject()
    const removed = normalized(vi.mocked(rm))
    expect(removed.some((p) => p.endsWith('.claude/skills'))).toBe(false)
    expect(removed.some((p) => p.endsWith('.github/skills'))).toBe(false)
    expect(removed.some((p) => p.endsWith('.gemini/skills'))).toBe(false)
  })
})
