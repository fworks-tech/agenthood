import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
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

  it('parses the repoInstructions opt-out (#1071)', async () => {
    await withFixture(JSON.stringify({ repoInstructions: false }), async () => {
      const cfg = await loadConfig()
      expect(cfg.repoInstructions).toBe(false)
    })
    await withFixture(JSON.stringify({}), async () => {
      const cfg = await loadConfig()
      expect(cfg.repoInstructions).toBeUndefined()
    })
  })

  it('rejects a non-boolean repoInstructions with a clear message (#1071)', async () => {
    await withFixture(JSON.stringify({ repoInstructions: 'false' }), async () => {
      await expect(loadConfig()).rejects.toThrow(
        'Invalid repoInstructions in .agenthood/config.json: expected true or false, got "false".',
      )
    })
  })

  it('accepts the config the rituals workflow generates with printf (#1071)', async () => {
    // The workflow writes this file before every ritual run; a format change
    // that stopped parsing would break every ritual, not just this feature.
    const workflow = readFileSync(
      join(import.meta.dirname, '..', '..', '..', '.github', 'workflows', 'rituals.yml'),
      'utf8',
    )
    const format = workflow.match(/printf '([^']*)' "\$OPENCODE_MODEL"/)?.[1]
    if (!format) throw new Error('printf format not found in rituals.yml')
    const generated = format.replace(/\\n/g, '\n').replace('%s', 'qwen3.8-flash')

    await withFixture(generated, async () => {
      const cfg = await loadConfig()
      expect(cfg.provider).toBe('opencode')
      expect(cfg.model).toBe('qwen3.8-flash')
      // Absent means the default: AGENTS.md keeps being injected.
      expect(cfg.repoInstructions).toBeUndefined()
    })
  })

  describe('mcpServers (ADR-047)', () => {
    it('leaves mcpServers undefined when the block is absent', async () => {
      await withFixture(JSON.stringify({}), async () => {
        const cfg = await loadConfig()
        expect(cfg.mcpServers).toBeUndefined()
      })
    })

    it('parses command and args, defaulting args to an empty array', async () => {
      await withFixture(JSON.stringify({
        mcpServers: { atlas: { command: 'node', args: ['tools/atlas-mcp.js'] }, bare: { command: 'tool' } },
      }), async () => {
        const cfg = await loadConfig()
        expect(cfg.mcpServers).toEqual({
          atlas: { command: 'node', args: ['tools/atlas-mcp.js'] },
          bare: { command: 'tool', args: [] },
        })
      })
    })

    it.each([
      ['an unknown key', { atlas: { command: 'node', foo: {} } }, 'unknown key "foo"'],
      ['an empty command', { atlas: { command: '' } }, '"command" must be a non-empty string'],
      ['a non-array args', { atlas: { command: 'node', args: 'not-an-array' } }, '"args" must be an array of strings'],
      ['non-string args', { atlas: { command: 'node', args: [1] } }, '"args" must be an array of strings'],
      ['a server name with an underscore', { bad_name: { command: 'node' } }, 'must match [a-z0-9][a-z0-9-]*'],
    ])('rejects %s before any spawn', async (_label, servers, message) => {
      await withFixture(JSON.stringify({ mcpServers: servers }), async () => {
        await expect(loadConfig()).rejects.toThrow(message)
      })
    })

    it('resolves ${env:VAR} in env and merges over inherited keys', async () => {
      process.env.AGENTHOOD_TEST_ENVVAL = 'secret-value'
      try {
        await withFixture(JSON.stringify({
          mcpServers: { atlas: { command: 'node', env: { API_KEY: '${env:AGENTHOOD_TEST_ENVVAL}', PLAIN: 'literal' } } },
        }), async () => {
          const cfg = await loadConfig()
          expect(cfg.mcpServers?.atlas.env).toEqual({ API_KEY: 'secret-value', PLAIN: 'literal' })
        })
      } finally {
        delete process.env.AGENTHOOD_TEST_ENVVAL
      }
    })

    it('preserves literal dollar signs in ${env:VAR} values', async () => {
      process.env.AGENTHOOD_TEST_ENVVAL = 'sk-$$-$&live'
      try {
        await withFixture(JSON.stringify({
          mcpServers: { atlas: { command: 'node', env: { API_KEY: '${env:AGENTHOOD_TEST_ENVVAL}' } } },
        }), async () => {
          const cfg = await loadConfig()
          expect(cfg.mcpServers?.atlas.env?.API_KEY).toBe('sk-$$-$&live')
        })
      } finally {
        delete process.env.AGENTHOOD_TEST_ENVVAL
      }
    })

    it('rejects a missing ${env:VAR} reference', async () => {
      await withFixture(JSON.stringify({
        mcpServers: { atlas: { command: 'node', env: { API_KEY: '${env:AGENTHOOD_NO_SUCH_VAR_X}' } } },
      }), async () => {
        await expect(loadConfig()).rejects.toThrow(/missing variable AGENTHOOD_NO_SUCH_VAR_X/)
      })
    })

    it('allows a literal value for a non-secret key that merely contains a secret word', async () => {
      await withFixture(JSON.stringify({
        mcpServers: { atlas: { command: 'node', env: { PATH: '/custom/bin', PATTERN: 'x', AUTHORS: 'y' } } },
      }), async () => {
        const cfg = await loadConfig()
        expect(cfg.mcpServers?.atlas.env).toEqual({ PATH: '/custom/bin', PATTERN: 'x', AUTHORS: 'y' })
      })
    })

    it.each([
      ['a stdio server with headers', { atlas: { command: 'node', headers: { 'X-A': 'b' } } }, '"headers" is not allowed for stdio'],
      ['an http server with command', { atlas: { transport: 'http', url: 'http://x', command: 'node' } }, '"command" is not allowed for http'],
      ['an http server with args', { atlas: { transport: 'http', url: 'http://x', args: [] } }, '"args" is not allowed for http'],
      ['an http server with env', { atlas: { transport: 'http', url: 'http://x', env: { A: 'b' } } }, '"env" is not allowed for http'],
      ['an unknown transport', { atlas: { transport: 'sse', url: 'http://x' } }, '"transport" must be "stdio" or "http"'],
    ])('rejects %s', async (_label, servers, message) => {
      await withFixture(JSON.stringify({ mcpServers: servers }), async () => {
        await expect(loadConfig()).rejects.toThrow(message)
      })
    })

    it('rejects a non-object env block', async () => {
      await withFixture(JSON.stringify({ mcpServers: { atlas: { command: 'node', env: 'x' } } }), async () => {
        await expect(loadConfig()).rejects.toThrow('"env" must be an object')
      })
    })

    it('rejects a literal value for a secret-like env key', async () => {
      await withFixture(JSON.stringify({
        mcpServers: { atlas: { command: 'node', env: { API_KEY: 'hunter2' } } },
      }), async () => {
        await expect(loadConfig()).rejects.toThrow(/secret-like and must use/)
      })
    })

    it('rejects a non-object mcpServers block', async () => {
      await withFixture(JSON.stringify({ mcpServers: ['node'] }), async () => {
        await expect(loadConfig()).rejects.toThrow('expected an object of servers')
      })
    })

    it('parses readOnly flag', async () => {
      await withFixture(JSON.stringify({
        mcpServers: { atlas: { command: 'node', readOnly: true }, bare: { command: 'tool' } },
      }), async () => {
        const cfg = await loadConfig()
        expect(cfg.mcpServers?.atlas.readOnly).toBe(true)
        expect(cfg.mcpServers?.bare.readOnly).toBeUndefined()
      })
    })

    it('resolves ${env:VAR} in http headers', async () => {
      process.env.AGENTHOOD_TEST_TOKEN = 'tok-123'
      try {
        await withFixture(JSON.stringify({
          mcpServers: { atlas: { transport: 'http', url: 'http://x', headers: { Authorization: 'Bearer ${env:AGENTHOOD_TEST_TOKEN}' } } },
        }), async () => {
          const cfg = await loadConfig()
          expect(cfg.mcpServers?.atlas.headers).toEqual({ Authorization: 'Bearer tok-123' })
        })
      } finally {
        delete process.env.AGENTHOOD_TEST_TOKEN
      }
    })

    it('rejects a literal secret-like http header', async () => {
      await withFixture(JSON.stringify({
        mcpServers: { atlas: { transport: 'http', url: 'http://x', headers: { Authorization: 'Bearer literal' } } },
      }), async () => {
        await expect(loadConfig()).rejects.toThrow(/secret-like and must use/)
      })
    })

    it('rejects a missing ${env:VAR} in http headers', async () => {
      await withFixture(JSON.stringify({
        mcpServers: { atlas: { transport: 'http', url: 'http://x', headers: { 'X-Api-Key': '${env:AGENTHOOD_NO_SUCH_HDR}' } } },
      }), async () => {
        await expect(loadConfig()).rejects.toThrow(/missing variable AGENTHOOD_NO_SUCH_HDR/)
      })
    })
  })
})
