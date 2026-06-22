import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>()
  return { ...actual, execSync: vi.fn() }
})

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return { ...actual, existsSync: vi.fn() }
})

import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'

describe('check command', () => {
  let output = ''

  beforeEach(() => {
    output = ''
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    vi.spyOn(console, 'log').mockImplementation((...args) => { output += args.join(' ') + '\n' })
    vi.mocked(execSync).mockReturnValue(Buffer.from(''))
    vi.mocked(existsSync).mockReturnValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reports commitlint.config.ts present when file exists', async () => {
    const { check } = await import('../../src/commands/check.js')
    await check()
    expect(output).toContain('commitlint.config.ts present')
    expect(output).toContain('✅')
  })

  it('reports commitlint.config.ts failing when file is missing', async () => {
    vi.mocked(existsSync).mockImplementation((p) =>
      typeof p === 'string' && p.includes('commitlint.config.ts') ? false : true
    )
    const { check } = await import('../../src/commands/check.js')
    await check()
    expect(output).toContain('commitlint.config.ts present')
    expect(output).toContain('❌')
  })

  it('does not reference .cjs in output', async () => {
    const { check } = await import('../../src/commands/check.js')
    await check()
    expect(output).not.toContain('commitlint.config.cjs')
  })

  it('prints health check header', async () => {
    const { check } = await import('../../src/commands/check.js')
    await check()
    expect(output).toContain('Agenthood Health Check')
  })

  it('prints passing count', async () => {
    const { check } = await import('../../src/commands/check.js')
    await check()
    expect(output).toContain('passing')
  })

  it('exits with code 1 when checks fail', async () => {
    vi.mocked(existsSync).mockReturnValue(false)
    const { check } = await import('../../src/commands/check.js')
    await check()
    expect(vi.mocked(process.exit)).toHaveBeenCalledWith(1)
  })
})
