import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>()
  return { ...actual, execSync: vi.fn() }
})

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return { ...actual, readdirSync: vi.fn(() => ['commit-msg', 'pre-commit', 'pre-push', 'prepare-commit-msg']), existsSync: vi.fn(() => true), chmodSync: vi.fn() }
})

import { execSync } from 'node:child_process'
import { chmodSync, readdirSync } from 'node:fs'

describe('setup command', () => {
  let output = ''

  beforeEach(() => {
    output = ''
    vi.spyOn(console, 'log').mockImplementation((...args) => { output += args.join(' ') + '\n' })
    vi.mocked(execSync).mockReturnValue(Buffer.from(''))
    vi.mocked(readdirSync).mockReturnValue(['commit-msg', 'pre-commit', 'pre-push', 'prepare-commit-msg'] as any)
    vi.mocked(chmodSync).mockReturnValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('prints the activation header', async () => {
    const { setup } = await import('../../src/commands/setup.js')
    await setup()
    expect(output).toContain('Activating Enforcement Layer')
  })

  it('confirms hooks path was set', async () => {
    const { setup } = await import('../../src/commands/setup.js')
    await setup()
    expect(output).toContain('git hooks path')
  })

  it('confirms hooks were made executable', async () => {
    const { setup } = await import('../../src/commands/setup.js')
    await setup()
    expect(output).toContain('hooks made executable')
  })

  it('confirms commit template was set', async () => {
    const { setup } = await import('../../src/commands/setup.js')
    await setup()
    expect(output).toContain('commit template')
  })

  it('runs git config core.hooksPath', async () => {
    const { setup } = await import('../../src/commands/setup.js')
    await setup()
    const calls = vi.mocked(execSync).mock.calls.map((c) => c[0] as string)
    expect(calls.some((c) => c.includes('core.hooksPath'))).toBe(true)
  })

  it('runs git config commit.template', async () => {
    const { setup } = await import('../../src/commands/setup.js')
    await setup()
    const calls = vi.mocked(execSync).mock.calls.map((c) => c[0] as string)
    expect(calls.some((c) => c.includes('commit.template'))).toBe(true)
  })

  it('calls chmodSync for each hook file', async () => {
    vi.mocked(chmodSync).mockClear()
    const { setup } = await import('../../src/commands/setup.js')
    await setup()
    expect(vi.mocked(chmodSync).mock.calls.length).toBe(4)
  })

  it('prints the closing confidence line', async () => {
    const { setup } = await import('../../src/commands/setup.js')
    await setup()
    expect(output).toContain('Ship with confidence')
  })
})
