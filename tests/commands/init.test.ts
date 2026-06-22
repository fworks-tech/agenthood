import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('node:readline', () => ({
  createInterface: vi.fn(() => ({
    question: vi.fn((_query: string, callback: (answer: string) => void) => callback('')),
    close: vi.fn(),
  })),
}))

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return { ...actual, copyFile: vi.fn(), mkdir: vi.fn(), readFile: vi.fn(), writeFile: vi.fn() }
})

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return { ...actual, existsSync: vi.fn() }
})

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>()
  return { ...actual, execSync: vi.fn() }
})

import { copyFile, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

describe('init command', () => {
  let output = ''
  let stdout = ''

  beforeEach(() => {
    output = ''
    stdout = ''
    vi.spyOn(console, 'log').mockImplementation((...args) => { output += args.join(' ') + '\n' })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => { stdout += String(chunk); return true })
    vi.mocked(execSync).mockReturnValue(Buffer.from(''))
    vi.mocked(copyFile).mockResolvedValue(undefined)
    vi.mocked(writeFile).mockResolvedValue(undefined)
    vi.mocked(readFile).mockRejectedValue(new Error('not found'))
    // By default: src paths exist, dest paths for commitlint don't, example config doesn't
    vi.mocked(existsSync).mockImplementation((p) => {
      if (typeof p !== 'string') return true
      if (p.includes('config.json') && !p.includes('config.example')) return false
      if (p.includes('config.example.json')) return false
      if (p.includes('commitlint.config.ts') && !p.includes('conventions')) return false
      return true
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('copies commitlint.config.ts from conventions', async () => {
    const { init } = await import('../../src/commands/init.js')
    await init()
    const calls = vi.mocked(copyFile).mock.calls.map((c) => c as [string, string])
    const tsCopies = calls.filter(([src, dest]) =>
      src.includes('commitlint.config.ts') && dest.includes('commitlint.config.ts')
    )
    expect(tsCopies.length).toBeGreaterThanOrEqual(1)
  })

  it('does not copy commitlint.config.cjs', async () => {
    const { init } = await import('../../src/commands/init.js')
    await init()
    const calls = vi.mocked(copyFile).mock.calls.map((c) => c as [string, string])
    const cjsCopies = calls.filter(([src, dest]) =>
      src.includes('commitlint.config.cjs') || dest.includes('commitlint.config.cjs')
    )
    expect(cjsCopies).toHaveLength(0)
  })

  it('writes config with commitlintConfig pointing to .ts, not .cjs', async () => {
    const { init } = await import('../../src/commands/init.js')
    await init()
    const writeCalls = vi.mocked(writeFile).mock.calls.map((c) => c as [string, string, object])
    const configCalls = writeCalls.filter(([path]) => path.includes('config.json'))
    expect(configCalls.length).toBeGreaterThanOrEqual(1)
    for (const [, content] of configCalls) {
      expect(content).toContain('commitlint.config.ts')
      expect(content).not.toContain('commitlint.config.cjs')
    }
  })

  it('prints the welcome message', async () => {
    const { init } = await import('../../src/commands/init.js')
    await init()
    expect(output).toContain('Welcome to the Agenthood')
  })

  it('prints the completion message', async () => {
    const { init } = await import('../../src/commands/init.js')
    await init()
    expect(output).toContain('Society is ready')
  })

  it('installs conventions step output', async () => {
    const { init } = await import('../../src/commands/init.js')
    await init()
    expect(stdout).toContain('Installing Conventions')
    expect(output).toContain('✅')
  })
})
