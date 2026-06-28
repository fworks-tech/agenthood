import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  }
})

vi.mock('../../../src/utils/hash.js', () => ({
  contentHash: vi.fn(() => 'abc123'),
}))

import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { status } from '../../../src/commands/status.js'

describe('status command', () => {
  beforeEach(() => {
    vi.mocked(existsSync).mockReset()
    vi.mocked(readdirSync).mockReset()
    vi.mocked(readFileSync).mockReset()
    vi.mocked(writeFileSync).mockReset()
    vi.mocked(mkdirSync).mockReset()
    vi.mocked(existsSync).mockReturnValue(false)
    vi.mocked(readdirSync).mockReturnValue([])
    vi.mocked(readFileSync).mockReturnValue('')
    vi.mocked(writeFileSync).mockReturnValue(undefined)
    vi.mocked(mkdirSync).mockReturnValue(undefined)
  })

  it('shows all zeros when nothing is set up', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await status()

    const output = log.mock.calls.flat().join(' ')
    expect(output).toContain('Members:     0')
    expect(output).toContain('Decisions:   0')
    expect(output).toContain('Lockfile:    absent')
    expect(output).toContain('Memory:      not initialized')
  })

  it('shows member count from members directory', async () => {
    vi.mocked(existsSync).mockImplementation((path) => {
      const p = path as string
      return p.includes('members') || p.includes('decisions') || p.includes('lock')
    })
    vi.mocked(readdirSync).mockImplementation((path) => {
      const p = path as string
      if (p.includes('members')) return [{ name: 'the-scribe', isDirectory: () => true }, { name: 'the-architect', isDirectory: () => true }] as any
      return []
    })

    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await status()

    const output = log.mock.calls.flat().join(' ')
    expect(output).toContain('Members:     2')
  })

  it('shows valid lockfile status', async () => {
    vi.mocked(existsSync).mockImplementation((path) => {
      const p = path as string
      return p.includes('lock')
    })
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ version: 1, members: { 'the-scribe': {}, 'the-architect': {} } }))

    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await status()

    const output = log.mock.calls.flat().join(' ')
    expect(output).toContain('valid (2 members locked)')
  })

  it('shows invalid lockfile when parsing fails', async () => {
    vi.mocked(existsSync).mockImplementation((path) => {
      const p = path as string
      return p.includes('lock')
    })
    vi.mocked(readFileSync).mockReturnValue('not valid json')

    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await status()

    const output = log.mock.calls.flat().join(' ')
    expect(output).toContain('Lockfile:    invalid')
  })

  it('shows memory initialized when .agenthood/memory exists', async () => {
    vi.mocked(existsSync).mockImplementation((path) => {
      const p = path as string
      return p.includes('memory') || p.includes('lock')
    })
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ version: 1, members: {} }))

    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await status()

    const output = log.mock.calls.flat().join(' ')
    expect(output).toContain('Memory:      initialized')
  })

  it('outputs JSON with --json flag', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await status(['--json'])

    const lastCall = log.mock.calls[log.mock.calls.length - 1][0]
    const parsed = JSON.parse(lastCall as string)
    expect(parsed).toHaveProperty('members', 0)
    expect(parsed).toHaveProperty('lockfile', 'absent')
  })

  it('reports no drift with --drift when lockfile matches', async () => {
    vi.mocked(existsSync).mockImplementation((path) => {
      const p = path as string
      return p.includes('lock') || p.includes('members')
    })
    vi.mocked(readdirSync).mockImplementation((path) => {
      const p = path as string
      if (p.includes('members')) return [{ name: 'the-scribe', isDirectory: () => true }] as any
      return []
    })
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ version: 1, members: { 'the-scribe': { version: 'abc123' } } }))

    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    await status(['--drift'])

    const output = log.mock.calls.flat().join(' ')
    expect(output).toContain('No drift detected')
    expect(exit).toHaveBeenCalledWith(0)
  })

  it('reports drift when lockfile hash differs', async () => {
    vi.mocked(existsSync).mockImplementation((path) => {
      const p = path as string
      return p.includes('lock') || p.includes('members')
    })
    vi.mocked(readdirSync).mockImplementation((path) => {
      const p = path as string
      if (p.includes('members')) return [{ name: 'the-scribe', isDirectory: () => true }] as any
      return []
    })
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ version: 1, members: { 'the-scribe': { version: 'def456' } } }))

    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    await status(['--drift'])

    const output = log.mock.calls.flat().join(' ')
    expect(output).toContain('Drift detected')
    expect(output).toContain('the-scribe')
    expect(exit).toHaveBeenCalledWith(0)
  })
})
