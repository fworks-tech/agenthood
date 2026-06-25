import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>()
  return { ...actual, execSync: vi.fn() }
})

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return { ...actual, existsSync: vi.fn(), readFileSync: vi.fn() }
})

import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

describe('check command', () => {
  let output = ''

  beforeEach(() => {
    output = ''
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    vi.spyOn(console, 'log').mockImplementation((...args) => { output += args.join(' ') + '\n' })
    vi.mocked(execSync).mockReturnValue(Buffer.from(''))
    vi.mocked(existsSync).mockImplementation((p) =>
      typeof p === 'string' && p.includes('config.json') ? false : true
    )
    vi.mocked(readFileSync).mockReturnValue('{}')
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

  it('reports API key check as passing when key is in environment', async () => {
    // config.json exists with provider=groq, and GROQ_API_KEY is set
    vi.mocked(existsSync).mockImplementation((p) =>
      typeof p === 'string' && !!p.match(/config\.json[\\/]?$/) ? true : true
    )
    vi.mocked(readFileSync).mockReturnValue('{"provider":"groq"}')
    process.env.GROQ_API_KEY = 'test-key'
    const { check } = await import('../../src/commands/check.js')
    await check()
    expect(output).toContain('API key')
    expect(output).toContain('✅')
    delete process.env.GROQ_API_KEY
  })

  it('reports API key check as failing when provider configured but no key', async () => {
    vi.mocked(existsSync).mockImplementation((p) =>
      typeof p === 'string' && !!p.match(/config\.json[\\/]?$/) ? true : true
    )
    vi.mocked(readFileSync).mockReturnValue('{"provider":"groq"}')
    delete process.env.GROQ_API_KEY
    const { check } = await import('../../src/commands/check.js')
    await check()
    expect(output).toContain('API key')
    expect(output).toContain('❌')
  })

  it('does not run api key check when no config.json present', async () => {
    vi.mocked(existsSync).mockImplementation((p) =>
      typeof p === 'string' && p.includes('config.json') ? false : true
    )
    const { check } = await import('../../src/commands/check.js')
    await check()
    expect(output).not.toContain('API key')
  })

  it('reports vector store initialized when directory exists', async () => {
    vi.mocked(existsSync).mockImplementation((p) =>
      typeof p === 'string' && p.includes('config.json') ? false : true
    )
    const { check } = await import('../../src/commands/check.js')
    await check()
    expect(output).toContain('LanceDB vector store initialized')
    expect(output).toContain('✅')
  })

  it('reports residual memory traces when file exists', async () => {
    vi.mocked(existsSync).mockImplementation((p) =>
      typeof p === 'string' && p.includes('config.json') ? false : true
    )
    const { check } = await import('../../src/commands/check.js')
    await check()
    expect(output).toContain('Residual memory traces found')
    expect(output).toContain('✅')
  })

  it('reports knowledge graph when file exists', async () => {
    vi.mocked(existsSync).mockImplementation((p) =>
      typeof p === 'string' && p.includes('config.json') ? false : true
    )
    const { check } = await import('../../src/commands/check.js')
    await check()
    expect(output).toContain('Knowledge graph found')
    expect(output).toContain('✅')
  })
})
