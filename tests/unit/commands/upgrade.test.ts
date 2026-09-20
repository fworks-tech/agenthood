import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  }
})

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>()
  return { ...actual, execFileSync: vi.fn() }
})

vi.mock('../../../src/skills/discovery/RemoteSkillSource.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/skills/discovery/RemoteSkillSource.ts')>()
  return { ...actual, fetchRemoteText: vi.fn() }
})

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fetchRemoteText } from '../../../src/skills/discovery/RemoteSkillSource.ts'
import { upgrade } from '../../../src/commands/upgrade.ts'

function exitSpy() {
  return vi.spyOn(process, 'exit').mockImplementation((() => {
    throw new Error('process.exit')
  }) as never)
}

describe('upgrade --agenthood', () => {
  let output: string[] = []

  beforeEach(() => {
    output = []
    vi.spyOn(console, 'log').mockImplementation((...a) => { output.push(a.join(' ')) })
    vi.spyOn(console, 'error').mockImplementation((...a) => { output.push(a.join(' ')) })
    vi.spyOn(console, 'warn').mockImplementation((...a) => { output.push(a.join(' ')) })
    vi.mocked(execFileSync).mockReset()
    vi.mocked(writeFileSync).mockClear()
    vi.mocked(readFileSync).mockImplementation(((p: unknown) =>
      String(p).endsWith('package.json') ? '{"version":"3.65.2"}' : '{"version":"1"}') as never)
    vi.mocked(existsSync).mockReturnValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('exits when the npm registry is unreachable', async () => {
    vi.mocked(fetchRemoteText).mockResolvedValue(undefined)
    const exit = exitSpy()
    await expect(upgrade(['--agenthood'])).rejects.toThrow('process.exit')
    expect(exit).toHaveBeenCalledWith(1)
    expect(vi.mocked(execFileSync)).not.toHaveBeenCalled()
  })

  it('reports already-latest without touching config or npm', async () => {
    vi.mocked(fetchRemoteText).mockResolvedValue('{"version":"3.65.2"}')
    await upgrade(['--agenthood'])
    expect(output.join('\n')).toContain('Already at the latest version')
    expect(vi.mocked(writeFileSync)).not.toHaveBeenCalled()
    expect(vi.mocked(execFileSync)).not.toHaveBeenCalled()
  })

  it('backs up config and runs npm install for a newer version', async () => {
    vi.mocked(fetchRemoteText).mockResolvedValue('{"version":"3.66.0"}')
    vi.mocked(readFileSync).mockImplementation(((p: unknown) =>
      String(p).endsWith('package.json') ? '{"version":"3.65.2"}' : '{"version":"1"}') as never)
    vi.mocked(execFileSync).mockReturnValue('' as never)

    await upgrade(['--agenthood'])

    const backup = vi.mocked(writeFileSync).mock.calls.find(([p]) => String(p).includes('backup'))
    expect(backup).toBeTruthy()
    expect(execFileSync).toHaveBeenCalledWith(
      'npm',
      ['install', '--no-fund', '--no-audit', 'agenthood@3.66.0'],
      expect.anything(),
    )
    expect(output.join('\n')).not.toContain('not recognized')
  })

  it('warns when the config version is unrecognized', async () => {
    vi.mocked(fetchRemoteText).mockResolvedValue('{"version":"3.66.0"}')
    vi.mocked(readFileSync).mockImplementation(((p: unknown) =>
      String(p).endsWith('package.json') ? '{"version":"3.65.2"}' : '{"version":"9"}') as never)
    vi.mocked(execFileSync).mockReturnValue('' as never)

    await upgrade(['--agenthood'])
    expect(output.join('\n')).toContain('not recognized')
  })

  it('surfaces a manual command when npm install fails', async () => {
    vi.mocked(fetchRemoteText).mockResolvedValue('{"version":"3.66.0"}')
    vi.mocked(readFileSync).mockImplementation(((p: unknown) =>
      String(p).endsWith('package.json') ? '{"version":"3.65.2"}' : '{"version":"1"}') as never)
    vi.mocked(execFileSync).mockImplementation((() => {
      throw new Error('npm offline')
    }) as never)
    const exit = exitSpy()

    await expect(upgrade(['--agenthood'])).rejects.toThrow('process.exit')
    expect(output.join('\n')).toContain('npm install agenthood@latest')
    expect(exit).toHaveBeenCalledWith(1)
  })
})
