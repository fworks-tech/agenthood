import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadConfig } from '../../../src/commands/config.ts'

function withFixture(contents: string, fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), 'agenthood-cfg-'))
  mkdirSync(join(dir, '.agenthood'), { recursive: true })
  writeFileSync(join(dir, '.agenthood', 'config.json'), contents)
  const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(dir)
  return fn(dir).finally(() => {
    cwdSpy.mockRestore()
    rmSync(dir, { recursive: true, force: true })
  })
}

describe('loadConfig', () => {
  beforeEach(() => {
    vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('process.exit') }) as never)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('parses a full config: provider block, providers, failover, skills', async () => {
    await withFixture(JSON.stringify({
      provider: { name: 'opencode', model: 'mimo-v2.5' },
      providers: [
        { name: 'opencode', model: 'mimo-v2.5', priority: 1 },
        { name: 'groq', model: 'llama-3.3-70b-versatile', priority: 2, models: ['a', 'b'] },
      ],
      failover: { failureThreshold: 3, cooldownMs: 60000, probeEnabled: true },
      skills: { catalogFormat: 'json' },
    }), async () => {
      const cfg = await loadConfig()
      expect(cfg.provider).toBe('opencode')
      expect(cfg.model).toBe('mimo-v2.5')
      expect(cfg.providers).toHaveLength(2)
      expect(cfg.providers![1]).toMatchObject({ name: 'groq', priority: 2, models: ['a', 'b'] })
      expect(cfg.failureThreshold).toBe(3)
      expect(cfg.cooldownMs).toBe(60000)
      expect(cfg.probeEnabled).toBe(true)
      expect(cfg.skills).toEqual({ catalogFormat: 'json' })
    })
  })

  it('keeps the sibling model when provider is a plain string', async () => {
    await withFixture(JSON.stringify({ provider: 'opencode', model: 'deepseek-v4-flash' }), async () => {
      const cfg = await loadConfig()
      expect(cfg.provider).toBe('opencode')
      expect(cfg.model).toBe('deepseek-v4-flash')
    })
  })

  it('parses the security block strict flag from config', async () => {
    await withFixture(JSON.stringify({ security: { strictSkillIntegrity: true } }), async () => {
      const cfg = await loadConfig()
      expect(cfg.security).toEqual({ strictSkillIntegrity: true, sandbox: false })
    })
  })

  it('parses the security block sandbox flag from config', async () => {
    await withFixture(JSON.stringify({ security: { sandbox: true } }), async () => {
      const cfg = await loadConfig()
      expect(cfg.security).toEqual({ strictSkillIntegrity: false, sandbox: true })
    })
  })

  it('omits the security block when absent', async () => {
    await withFixture(JSON.stringify({ provider: { name: 'opencode' } }), async () => {
      const cfg = await loadConfig()
      expect(cfg.security).toBeUndefined()
    })
  })

  it('returns empty config when the file is missing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'agenthood-nocfg-'))
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(dir)
    try {
      expect(await loadConfig()).toEqual({})
    } finally {
      cwdSpy.mockRestore()
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('throws an error on corrupt JSON', async () => {
    await withFixture('{ not json', async () => {
      await expect(loadConfig()).rejects.toThrow('Invalid JSON')
    })
  })

  it('throws an error on an unreadable config file', async () => {
    await withFixture('{}', async (dir) => {
      // a directory in place of the config file reads as EISDIR/EPERM
      rmSync(join(dir, '.agenthood', 'config.json'))
      mkdirSync(join(dir, '.agenthood', 'config.json'))
      await expect(loadConfig()).rejects.toThrow(/Cannot read/)
    })
  })

  it('applies --provider override on top of the file config', async () => {
    await withFixture(JSON.stringify({ provider: { name: 'opencode' } }), async () => {
      const cfg = await loadConfig('ollama')
      expect(cfg.provider).toBe('ollama')
    })
  })

  it('accepts a string provider for legacy configs', async () => {
    await withFixture(JSON.stringify({ provider: 'groq' }), async () => {
      expect((await loadConfig()).provider).toBe('groq')
    })
  })

  it('ignores malformed provider entries', async () => {
    await withFixture(JSON.stringify({
      providers: [null, { priority: 3 }, { name: 'ollama' }],
    }), async () => {
      const cfg = await loadConfig()
      expect(cfg.providers).toHaveLength(1)
      expect(cfg.providers![0].name).toBe('ollama')
    })
  })

  it('parses the skills catalog, disable and fallback settings (#528, #537, #556, #613)', async () => {
    await withFixture(JSON.stringify({
      skills: {
        catalogFormat: 'json',
        providerFormats: { google: 'text', bogus: 'yaml' },
        disabled: ['noisy', 42],
        fallback: false,
      },
    }), async () => {
      const cfg = await loadConfig()
      expect(cfg.skills).toEqual({
        catalogFormat: 'json',
        providerFormats: { google: 'text' },
        disabled: ['noisy'],
        fallback: false,
      })
    })
  })

  it('warns and uses the provider default for an unknown catalog format', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await withFixture(JSON.stringify({ skills: { catalogFormat: 'yaml' } }), async () => {
      const cfg = await loadConfig()
      expect(cfg.skills?.catalogFormat).toBeUndefined()
      expect(warn.mock.calls.flat().join(' ')).toContain('catalogFormat')
    })
  })
})
