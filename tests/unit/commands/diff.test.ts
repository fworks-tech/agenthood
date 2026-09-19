import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
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
import { diff } from '../../../src/commands/diff.ts'
import { contentHash } from '../../../src/utils/hash.ts'

const LOCKED_CONTENT = 'locked content'
const LOCKED_HASH = contentHash(LOCKED_CONTENT)

function lockFor(members: Record<string, string>): string {
  return JSON.stringify({
    version: 1,
    members: Object.fromEntries(
      Object.entries(members).map(([m, hash]) => [m, { version: hash, updatedAt: '' }]),
    ),
  })
}

function mockLockAndSkill(lock: string, current: string): void {
  vi.mocked(existsSync).mockReturnValue(true)
  vi.mocked(readFileSync).mockImplementation(((p: unknown) =>
    String(p).includes('agenthood.lock') ? lock : current) as never)
}

describe('diff command', () => {
  beforeEach(() => {
    vi.mocked(execFileSync).mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('errors when the lockfile is missing', async () => {
    vi.mocked(existsSync).mockImplementation((p) => !String(p).includes('agenthood.lock'))
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit')
    }) as never)

    await expect(diff([])).rejects.toThrow('process.exit')
    expect(exit).toHaveBeenCalledWith(1)
  })

  it('rejects an invalid member name before touching git', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit')
    }) as never)

    await expect(diff(['bad;name'])).rejects.toThrow('process.exit')
    expect(exit).toHaveBeenCalledWith(1)
    expect(vi.mocked(execFileSync)).not.toHaveBeenCalled()
  })

  it('reports no differences when content matches the lock', async () => {
    mockLockAndSkill(lockFor({ 'the-test': LOCKED_HASH }), LOCKED_CONTENT)
    const output: string[] = []
    vi.spyOn(console, 'log').mockImplementation((...a) => { output.push(a.join(' ')) })

    await diff([])

    expect(output.join('\n')).toContain('No differences vs agenthood.lock')
    expect(vi.mocked(execFileSync)).not.toHaveBeenCalled()
  })

  it('shows the git diff vs the locked revision and exits 1 on drift', async () => {
    mockLockAndSkill(lockFor({ 'the-test': LOCKED_HASH }), 'drifted content')
    vi.mocked(execFileSync)
      .mockReturnValueOnce('abc123\n' as never)
      .mockReturnValueOnce(LOCKED_CONTENT as never)
      .mockReturnValueOnce('-locked content\n+drifted content\n' as never)
    const output: string[] = []
    vi.spyOn(console, 'log').mockImplementation((...a) => { output.push(a.join(' ')) })
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit')
    }) as never)

    await expect(diff([])).rejects.toThrow('process.exit')

    const diffCall = vi.mocked(execFileSync).mock.calls.find(
      ([, args]) => (args as string[])[0] === 'diff',
    )
    expect(diffCall).toBeTruthy()
    expect((diffCall![1] as string[])[1]).toBe('abc123')
    expect(output.join('\n')).toContain('drifted content')
    expect(exit).toHaveBeenCalledWith(1)
  })

  it('notes members whose locked revision is missing from git history', async () => {
    mockLockAndSkill(lockFor({ 'the-test': LOCKED_HASH }), 'drifted content')
    vi.mocked(execFileSync).mockReturnValue('' as never)
    const output: string[] = []
    vi.spyOn(console, 'log').mockImplementation((...a) => { output.push(a.join(' ')) })
    vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit')
    }) as never)

    await expect(diff([])).rejects.toThrow('process.exit')
    expect(output.join('\n')).toContain('locked version not found in git history')
  })

  it('skips hostile lockfile keys and never passes them to git', async () => {
    mockLockAndSkill(
      lockFor({ 'x"; touch pwned; echo "': LOCKED_HASH, 'the-test': LOCKED_HASH }),
      'drifted content',
    )
    vi.mocked(execFileSync)
      .mockReturnValueOnce('abc123\n' as never)
      .mockReturnValueOnce(LOCKED_CONTENT as never)
      .mockReturnValueOnce('diff text\n' as never)
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit')
    }) as never)

    await expect(diff([])).rejects.toThrow('process.exit')

    const allArgs = vi.mocked(execFileSync).mock.calls.flatMap((c) => c[1] as string[])
    expect(allArgs.some((a) => a.includes('touch pwned'))).toBe(false)
    expect(allArgs.some((a) => a.includes(';'))).toBe(false)
  })
})
