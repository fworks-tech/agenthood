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
    execFileSync: vi.fn(),
  }
})

import { existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { rollback } from '../../../src/commands/rollback.js'
import { contentHash } from '../../../src/utils/hash.js'

const LOCKED_CONTENT = 'locked content'
const LOCKED_HASH = contentHash(LOCKED_CONTENT)

const VALID_LOCK = JSON.stringify({
  version: 1,
  members: {
    'the-test': {
      version: LOCKED_HASH,
      updatedAt: '2026-06-27T12:00:00.000Z',
    },
  },
})

describe('rollback command', () => {
  beforeEach(() => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockReturnValue(VALID_LOCK)
    vi.mocked(execFileSync).mockReset()
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
    vi.mocked(execFileSync)
      .mockReturnValueOnce('abc123\nabc456\n' as never) // git log
      .mockReturnValueOnce('current content' as never)  // git show abc123 (no match)
      .mockReturnValueOnce(LOCKED_CONTENT as never)     // git show abc456 (match)

    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)

    await rollback(['--dry-run'])

    // Should NOT have called git checkout
    const checkoutCalls = vi.mocked(execFileSync).mock.calls.filter(
      ([cmd, args]) => cmd === 'git' && (args as string[])[0] === 'checkout'
    )
    expect(checkoutCalls).toHaveLength(0)
  })

  it('restores member from matching commit via git checkout', async () => {
    vi.mocked(execFileSync)
      .mockReturnValueOnce('abc123\nabc456\n' as never) // git log
      .mockReturnValueOnce(LOCKED_CONTENT as never)     // git show abc123

    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)

    await rollback([])

    expect(execFileSync).toHaveBeenCalledWith(
      'git',
      ['checkout', 'abc123', '--', expect.stringMatching(/members[\\/]the-test[\\/]SKILL\.md$/)],
      expect.anything()
    )
  })

  it('skips hostile lockfile keys and never passes them to git', async () => {
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      version: 1,
      members: {
        'x"; touch pwned; echo "': { version: LOCKED_HASH, updatedAt: '' },
        'the-test': { version: LOCKED_HASH, updatedAt: '' },
      },
    }) as never)
    vi.mocked(execFileSync)
      .mockReturnValueOnce('abc123\n' as never) // git log (the-test only)
      .mockReturnValueOnce(LOCKED_CONTENT as never)

    const output: string[] = []
    vi.spyOn(console, 'log').mockImplementation((...a) => { output.push(a.join(' ')) })
    vi.spyOn(console, 'warn').mockImplementation((...a) => { output.push(a.join(' ')) })
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)

    await rollback(['--dry-run'])

    expect(output.join('\n')).toContain('Skipping invalid member key from lockfile')
    const allArgs = vi.mocked(execFileSync).mock.calls.flatMap((c) => c[1] as string[])
    expect(allArgs.some((a) => a.includes('touch pwned'))).toBe(false)
    expect(allArgs.some((a) => a.includes(';'))).toBe(false)
  })

  it('rejects an invalid CLI member name before touching git', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)
    await rollback(['bad;name'])
    expect(exit).toHaveBeenCalledWith(1)
    expect(vi.mocked(execFileSync)).not.toHaveBeenCalled()
  })
})
