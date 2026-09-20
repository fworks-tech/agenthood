import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    rmSync: vi.fn(),
    writeFileSync: vi.fn(),
  }
})

import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { remove } from '../../../src/commands/remove.ts'

function exitSpy() {
  return vi.spyOn(process, 'exit').mockImplementation((() => {
    throw new Error('process.exit')
  }) as never)
}

function fsFor(skillsDirExists: boolean, lockContent?: string) {
  vi.mocked(existsSync).mockImplementation((p) => {
    const s = String(p)
    if (/[\\/]\.(claude|codebuddy|gemini)$/.test(s)) return false
    if (s.endsWith('SKILL.md') || s.includes('my-cool-skill')) return skillsDirExists
    if (s.endsWith('skills-lock.json')) return lockContent !== undefined
    return true
  })
  if (lockContent !== undefined) {
    vi.mocked(readFileSync).mockReturnValue(lockContent)
  }
}

const LOCK_WITH_ENTRY = JSON.stringify({
  version: 1,
  skills: { 'my-cool-skill': { source: 'https://example.com', installedAt: 'x' } },
})

describe('remove command', () => {
  let output: string[] = []

  beforeEach(() => {
    output = []
    vi.spyOn(console, 'log').mockImplementation((...a) => { output.push(a.join(' ')) })
    vi.spyOn(console, 'error').mockImplementation((...a) => { output.push(a.join(' ')) })
    vi.spyOn(console, 'warn').mockImplementation((...a) => { output.push(a.join(' ')) })
    vi.mocked(rmSync).mockClear()
    vi.mocked(writeFileSync).mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('requires a skill name', async () => {
    const exit = exitSpy()
    await expect(remove([])).rejects.toThrow('process.exit')
    expect(exit).toHaveBeenCalledWith(1)
  })

  it('rejects hostile names before touching the filesystem', async () => {
    const exit = exitSpy()
    await expect(remove(['../../etc/passwd'])).rejects.toThrow('process.exit')
    expect(exit).toHaveBeenCalledWith(1)
    expect(vi.mocked(rmSync)).not.toHaveBeenCalled()
  })

  it('refuses to remove a Society member', async () => {
    const exit = exitSpy()
    await expect(remove(['the-scribe'])).rejects.toThrow('process.exit')
    expect(output.join('\n')).toContain('deactivate')
    expect(vi.mocked(rmSync)).not.toHaveBeenCalled()
  })

  it('errors when the skill is not installed', async () => {
    fsFor(false)
    const exit = exitSpy()
    await expect(remove(['my-cool-skill'])).rejects.toThrow('process.exit')
    expect(output.join('\n')).toContain('not installed')
  })

  it('--dry-run removes nothing', async () => {
    fsFor(true, LOCK_WITH_ENTRY)
    await remove(['my-cool-skill', '--dry-run'])
    expect(output.join('\n')).toContain('Dry run')
    expect(vi.mocked(rmSync)).not.toHaveBeenCalled()
    expect(vi.mocked(writeFileSync)).not.toHaveBeenCalled()
  })

  it('removes the skill directory and its lockfile entry', async () => {
    fsFor(true, LOCK_WITH_ENTRY)
    await remove(['my-cool-skill'])
    expect(vi.mocked(rmSync)).toHaveBeenCalledWith(
      expect.stringContaining('my-cool-skill'),
      { recursive: true, force: true },
    )
    const written = vi.mocked(writeFileSync).mock.calls.find(([p]) => String(p).endsWith('skills-lock.json'))
    expect(written).toBeTruthy()
    expect(JSON.parse(String(written![1])).skills).toEqual({})
    expect(output.join('\n')).toContain('skills-lock.json')
  })
})
