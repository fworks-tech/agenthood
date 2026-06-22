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

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>()
  return { ...actual, execSync: vi.fn() }
})

import { rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

describe('eject command', () => {
  let output = ''

  beforeEach(() => {
    output = ''
    vi.spyOn(console, 'log').mockImplementation((...args) => { output += args.join(' ') + '\n' })
    vi.mocked(rm).mockResolvedValue(undefined)
    vi.mocked(execSync).mockReturnValue(Buffer.from(''))
    vi.mocked(existsSync).mockReturnValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('removes commitlint.config.ts', async () => {
    const { eject } = await import('../../src/commands/eject.js')
    await eject()
    expect(output).toContain('commitlint.config.ts')
    expect(output).toContain('Removed:')
  })

  it('calls rm with commitlint.config.ts path', async () => {
    const { eject } = await import('../../src/commands/eject.js')
    await eject()
    const calls = vi.mocked(rm).mock.calls.map((c) => c[0] as string)
    expect(calls.some((p) => p.endsWith('commitlint.config.ts'))).toBe(true)
  })

  it('handles missing commitlint.config.ts gracefully', async () => {
    vi.mocked(existsSync).mockImplementation((p) =>
      typeof p === 'string' && p.includes('commitlint.config.ts') ? false : true
    )
    const { eject } = await import('../../src/commands/eject.js')
    await eject()
    expect(output).not.toContain('commitlint.config.ts')
  })

  it('prints the eject header', async () => {
    const { eject } = await import('../../src/commands/eject.js')
    await eject()
    expect(output).toContain('Ejecting the Society')
  })

  it('runs git config --unset commit.template', async () => {
    const { eject } = await import('../../src/commands/eject.js')
    await eject()
    const calls = vi.mocked(execSync).mock.calls.map((c) => c[0] as string)
    expect(calls.some((c) => c.includes('commit.template'))).toBe(true)
  })
})
