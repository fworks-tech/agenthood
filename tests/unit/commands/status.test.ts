import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
    readFileSync: vi.fn(),
  }
})

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { status } from '../../../src/commands/status.js'

describe('status command', () => {
  beforeEach(() => {
    vi.mocked(existsSync).mockReturnValue(false)
    vi.mocked(readdirSync).mockReturnValue([])
    vi.mocked(readFileSync).mockReturnValue('')
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
})
