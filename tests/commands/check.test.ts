import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return { ...actual, existsSync: vi.fn(), readFileSync: vi.fn() }
})

import { existsSync, readFileSync } from 'node:fs'

describe('check command', () => {
  let output = ''

  beforeEach(() => {
    output = ''
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    vi.spyOn(console, 'log').mockImplementation((...args) => { output += args.join(' ') + '\n' })
    vi.mocked(existsSync).mockImplementation((p) =>
      typeof p === 'string' && p.includes('config.json') ? false : true
    )
    vi.mocked(readFileSync).mockReturnValue('{}')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('prints health check header', async () => {
    const { check } = await import( '../../src/commands/check.ts')
    await check()
    expect(output).toContain('Agenthood Health Check')
  })

  it('prints passing count', async () => {
    const { check } = await import( '../../src/commands/check.ts')
    await check()
    expect(output).toContain('passing')
  })

  it('exits with code 1 when checks fail', async () => {
    vi.mocked(existsSync).mockReturnValue(false)
    const { check } = await import( '../../src/commands/check.ts')
    await check()
    expect(vi.mocked(process.exit)).toHaveBeenCalledWith(1)
  })

  it('reports API key check as passing when key is in environment', async () => {
    vi.mocked(existsSync).mockImplementation(() => true)
    vi.mocked(readFileSync).mockReturnValue('{"provider":"groq"}')
    process.env.GROQ_API_KEY = 'test-key'
    const { check } = await import( '../../src/commands/check.ts')
    await check()
    expect(output).toContain('API key')
    expect(output).toContain('✅')
    delete process.env.GROQ_API_KEY
  })

  it('reports API key check as failing when provider configured but no key', async () => {
    vi.mocked(existsSync).mockImplementation(() => true)
    vi.mocked(readFileSync).mockReturnValue('{"provider":"groq"}')
    delete process.env.GROQ_API_KEY
    const { check } = await import( '../../src/commands/check.ts')
    await check()
    expect(output).toContain('API key')
    expect(output).toContain('❌')
  })

  it('does not run api key check when no config.json present', async () => {
    vi.mocked(existsSync).mockImplementation((p) =>
      typeof p === 'string' && p.includes('config.json') ? false : true
    )
    const { check } = await import( '../../src/commands/check.ts')
    await check()
    expect(output).not.toContain('API key')
  })

  it('reports AGENTS.md present when file exists', async () => {
    const { check } = await import( '../../src/commands/check.ts')
    await check()
    expect(output).toContain('AGENTS.md present')
    expect(output).toContain('✅')
  })

  it('reports agenthood config found when directory exists', async () => {
    vi.mocked(existsSync).mockImplementation((p) =>
      typeof p === 'string' && p.includes('config.json') ? false : true
    )
    const { check } = await import( '../../src/commands/check.ts')
    await check()
    expect(output).toContain('Agenthood config found')
    expect(output).toContain('✅')
  })
})
