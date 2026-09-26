import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'node:crypto'

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
    expect(log.mock.calls.flat().join(' ')).toContain('Restored 1 file')
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

describe('verify --fix restores resource drift (#604)', () => {
  const RESOURCE = 'echo "original"\n'
  const resourceLock = JSON.stringify({
    version: 1,
    members: {
      'the-test': {
        version: contentHash(ORIGINAL),
        updatedAt: '2026-01-01T00:00:00.000Z',
        resources: { 'scripts/run.sh': fileHashOf(RESOURCE) },
      },
    },
  })

  function fileHashOf(content: string): string {
    return createHash('sha256').update(Buffer.from(content, 'utf8')).digest('hex')
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(execFileSync).mockImplementation(((cmd: string, args: string[]) => {
      if (args[0] === 'log') return 'deadbee\n'
      if (args[0] === 'show') return args[1]!.includes('scripts/') ? Buffer.from(RESOURCE) : ORIGINAL
      return ''
    }) as any)
  })

  it('checks out a tampered scripts/ file from the locked revision', async () => {
    // readdirSync drives collectResourceHashes: one drifted file, wrong hash.
    vi.mocked(readdirSync).mockImplementation(((p: string) =>
      String(p).endsWith('scripts') ? [{ name: 'run.sh', isFile: () => true }] : []
    ) as any)
    vi.mocked(readFileSync).mockImplementation(((p: string) => {
      if (String(p).endsWith('agenthood.lock')) return resourceLock
      if (String(p).includes('run.sh')) return 'echo "TAMPERED"\n'
      return TAMPERED
    }) as any)

    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)
    await verify(['--fix', 'the-test'])

    const checkouts = vi.mocked(execFileSync).mock.calls.filter((c) => (c[1] as string[])[0] === 'checkout')
    expect(checkouts.map((c) => (c[1] as string[])[3]).some((p) => p?.endsWith('the-test/scripts/run.sh'))).toBe(true)
    expect(log.mock.calls.flat().join(' ')).toContain('the-test/scripts/run.sh')
    expect(exit).not.toHaveBeenCalledWith(1)
  })

  it('refuses to restore an untracked resource and asks for a re-lock', async () => {
    vi.mocked(readdirSync).mockImplementation(((p: string) =>
      String(p).endsWith('scripts') ? [{ name: 'evil.sh', isFile: () => true }] : []
    ) as any)
    vi.mocked(readFileSync).mockImplementation(((p: string) =>
      String(p).endsWith('agenthood.lock') ? resourceLock : TAMPERED
    ) as any)

    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)
    await verify(['--fix', 'the-test'])

    const output = log.mock.calls.flat().join(' ')
    expect(output).toContain('untracked resource scripts/evil.sh')
    const checkouts = vi.mocked(execFileSync).mock.calls.filter((c) => (c[1] as string[])[0] === 'checkout')
    expect(checkouts.map((c) => (c[1] as string[])[3]).some((p) => p?.endsWith('the-test/scripts/evil.sh'))).toBe(false)
    expect(exit).not.toHaveBeenCalledWith(1)
  })
})
