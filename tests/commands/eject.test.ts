import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return { ...actual, rm: vi.fn() }
})

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    existsSync: vi.fn(() => true),
    readFileSync: vi.fn(() => '{}'),
    writeFileSync: vi.fn(),
  }
})

import { rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'

describe('eject command', () => {
  let output = ''

  beforeEach(() => {
    output = ''
    vi.spyOn(console, 'log').mockImplementation((...args) => { output += args.join(' ') + '\n' })
    vi.mocked(rm).mockResolvedValue(undefined)
    vi.mocked(existsSync).mockReturnValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('prints the eject header', async () => {
    const { eject } = await import('../../src/commands/eject.js')
    await eject()
    expect(output).toContain('Ejecting the Society')
  })

  it('removes .agenthood directory', async () => {
    const { eject } = await import('../../src/commands/eject.js')
    await eject()
    expect(output).toContain('Removed: .agenthood')
  })

  it('removes AGENTS.md', async () => {
    const { eject } = await import('../../src/commands/eject.js')
    await eject()
    expect(output).toContain('Removed: AGENTS.md')
  })

  it('handles missing files gracefully', async () => {
    vi.mocked(existsSync).mockReturnValue(false)
    const { eject } = await import('../../src/commands/eject.js')
    await eject()
    expect(output).not.toContain('Removed:')
  })

  it('calls rm with .agenthood path', async () => {
    const { eject } = await import('../../src/commands/eject.js')
    await eject()
    const calls = vi.mocked(rm).mock.calls.map((c) => c[0] as string)
    expect(calls.some((p) => p.endsWith('.agenthood'))).toBe(true)
  })
})
