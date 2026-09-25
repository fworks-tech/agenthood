import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    readdirSync: vi.fn(),
  }
})

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>()
  return {
    ...actual,
    execFileSync: vi.fn(),
  }
})

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { verify } from '../../../src/commands/verify.ts'
import { contentHash } from '../../../src/utils/hash.ts'

const ORIGINAL = '---\nname: the-test\ndescription: A test member\nlicense: MIT\n---\n\n# The Test\n'
const TAMPERED = ORIGINAL + '\nTAMPERED'

const lockContent = JSON.stringify({
  version: 1,
  members: { 'the-test': { version: contentHash(ORIGINAL), updatedAt: '2026-01-01T00:00:00.000Z' } },
})

describe('verify --fix (#604)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readdirSync).mockReturnValue([])
    vi.mocked(readFileSync).mockImplementation(((p: string) =>
      String(p).endsWith('agenthood.lock') ? lockContent : TAMPERED
    ) as any)
    vi.mocked(execFileSync).mockImplementation(((cmd: string, args: string[]) => {
      if (args[0] === 'log') return 'deadbee\n'
      if (args[0] === 'show') return ORIGINAL
      return ''
    }) as any)
  })

  it('restores a drifted member from git history', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)
    await verify(['--fix', 'the-test'])
    expect(vi.mocked(execFileSync)).toHaveBeenCalledWith('git', expect.arrayContaining(['checkout']), expect.anything())
    expect(exit).not.toHaveBeenCalledWith(1)
    expect(log.mock.calls.flat().join(' ')).toContain('Restored 1 member')
  })

  it('reports members with no matching revision instead of restoring', async () => {
    vi.mocked(execFileSync).mockImplementation(((cmd: string, args: string[]) => {
      if (args[0] === 'log') return ''
      return ''
    }) as any)
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)
    await verify(['--fix', 'the-test'])
    expect(exit).toHaveBeenCalledWith(1)
    expect(log.mock.calls.flat().join(' ')).toContain('no matching revision')
  })
})
