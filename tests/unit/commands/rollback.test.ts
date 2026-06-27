import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
  }
})

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>()
  return {
    ...actual,
    execSync: vi.fn(),
  }
})

import { existsSync, readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { rollback } from '../../../src/commands/rollback.js'

function computeHash(content: string): string {
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash).toString(16).padStart(8, '0')
}

const LOCKED_CONTENT = 'locked content'
const LOCKED_HASH = computeHash(LOCKED_CONTENT)

const VALID_LOCK = JSON.stringify({
  version: 1,
  members: {
    'the-test': {
      version: `sha256:${LOCKED_HASH}`,
      updatedAt: '2026-06-27T12:00:00.000Z',
    },
  },
})

describe('rollback command', () => {
  beforeEach(() => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockReturnValue(VALID_LOCK)
    vi.mocked(execSync).mockReset()
  })

  it('errors when lockfile is missing', async () => {
    vi.mocked(existsSync).mockReturnValue(false)
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)

    await rollback([])
    expect(exit).toHaveBeenCalledWith(1)
  })

  it('errors when lockfile is invalid', async () => {
    vi.mocked(readFileSync).mockReturnValue('not json')
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)

    await rollback([])
    expect(exit).toHaveBeenCalledWith(1)
  })

  it('errors when target member not in lockfile', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)

    await rollback(['nonexistent'])
    expect(exit).toHaveBeenCalledWith(1)
  })

  it('shows dry-run output without restoring', async () => {
    vi.mocked(execSync)
      .mockReturnValueOnce('abc123\nabc456\n') // git log
      .mockReturnValueOnce('current content')  // git show abc123 (no match)
      .mockReturnValueOnce(LOCKED_CONTENT)     // git show abc456 (match)

    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)

    await rollback(['--dry-run'])

    // Should NOT have called git checkout
    const checkoutCalls = vi.mocked(execSync).mock.calls.filter(
      ([cmd]) => (cmd as string).startsWith('git checkout')
    )
    expect(checkoutCalls).toHaveLength(0)
  })

  it('restores member from matching commit', async () => {
    vi.mocked(execSync)
      .mockReturnValueOnce('abc123\nabc456\n') // git log
      .mockReturnValueOnce(LOCKED_CONTENT)     // git show abc123

    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)

    await rollback([])

    expect(execSync).toHaveBeenCalledWith(
      expect.stringContaining('git checkout abc123'),
      expect.anything()
    )
  })
})
