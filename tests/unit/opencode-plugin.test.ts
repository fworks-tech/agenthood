import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import pluginModule, {
  appendCapped,
  buildRunMemberTool,
  collectOutput,
  discoverMemberNames,
  formatRunResult,
  getMemberNames,
  mirrorRunRecord,
  parseRedisTarget,
  wireAgenthoodConfig,
} from '../../src/opencode-plugin.ts'
import type { RedisSocket, RunRecord } from '../../src/opencode-plugin.ts'
import type { PluginConfig } from '../../src/opencode-plugin.ts'
import { rawSpecs } from '../../src/members/member-specs.ts'
import { syncLiveAgent, syncOpencodeAgents } from '../../scripts/sync-opencode-agents.ts'
import { fakeChild, parseSkill, repoRoot } from '../helpers/opencodePluginFixtures.ts'

describe('agenthood opencode plugin', () => {
  it('default-exports a PluginModule with id and server', () => {
    expect(pluginModule.id).toBe('agenthood')
    expect(typeof pluginModule.server).toBe('function')
  })

  it('config hook wires the skills dir, AGENTS.md, and the agenthood-live agent', async () => {
    const hooks = await (pluginModule.server as any)()
    const cfg: PluginConfig = {}
    await hooks.config?.(cfg)

    expect(cfg.skills?.paths?.some((p) => p.endsWith('skills'))).toBe(true)
    expect(cfg.instructions?.some((i) => i.endsWith('AGENTS.md'))).toBe(true)
    expect(cfg.agent?.['agenthood-live']?.mode).toBe('primary')
    expect(cfg.agent?.['agenthood-live']?.description).toBeTruthy()
    expect(cfg.agent?.['the-steward']).toBeUndefined()
  })

  it('registers agenthood_run_member with a member enum and task string', async () => {
    const hooks = await (pluginModule.server as any)()
    const def = hooks.tool?.['agenthood_run_member']
    expect(def).toBeDefined()
    expect(def?.description).toContain(getMemberNames().join(', '))
    expect(def?.args.member).toBeDefined()
    expect(def?.args.task).toBeDefined()
  })

  it('matches the member list against the canonical registry (single manifest)', () => {
    // Intentional direction: the registry is truth. A spec without a shipped
    // SKILL.md fails here on purpose — the tool enum derives from skills/ and
    // the two must stay in sync (a member with no skill file cannot run).
    const registryNames = rawSpecs.map((s) => s.name).sort()
    expect(getMemberNames()).toEqual(registryNames)
  })
})

describe('discoverMemberNames', () => {
  const fakeFs = (entries: Array<{ name: string; dir: boolean; skill: boolean }>, throws: unknown = null) => ({
    readdir: (_path: string) => {
      if (throws !== null) throw throws
      return entries.map((e) => ({ name: e.name, isDirectory: () => e.dir }))
    },
    exists: (p: string) => entries.some((e) => e.dir && e.skill && p.replace(/\\/g, '/').endsWith(`${e.name}/SKILL.md`)),
    warn: (...args: unknown[]) => {
      warnings.push(args.join(' '))
    },
  })
  let warnings: string[]

  beforeEach(() => {
    warnings = []
  })

  it('filters non-dirs, non-members and skill-less dirs, then sorts', () => {
    const names = discoverMemberNames(
      '/skills',
      fakeFs([
        { name: 'the-zulu', dir: true, skill: true },
        { name: 'the-alpha', dir: true, skill: true },
        { name: 'plain-file', dir: false, skill: false },
        { name: 'the-noskill', dir: true, skill: false },
        { name: 'aws', dir: true, skill: true },
      ]),
    )
    expect(names).toEqual(['the-alpha', 'the-zulu'])
    expect(warnings).toEqual([])
  })

  it('warns and disables the tool when the skills dir is unreadable', () => {
    const names = discoverMemberNames('/skills', fakeFs([], new Error('EACCES')))
    expect(names).toEqual([])
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('/skills')
  })

  it('stringifies non-Error discovery failures', () => {
    const names = discoverMemberNames('/skills', {
      readdir: () => {
        throw 'boom'
      },
      exists: () => true,
      warn: (...args: unknown[]) => {
        warnings.push(args.join(' '))
      },
    })
    expect(names).toEqual([])
    expect(warnings).toEqual(['[agenthood] skills dir unreadable (/skills), member tool disabled: boom'])
  })

  it('reads the shipped skills dir by default', () => {
    expect(discoverMemberNames(join(repoRoot, 'skills'))).toEqual(getMemberNames())
  })

  it('routes default-filesystem failures to console.warn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const names = discoverMemberNames(join(repoRoot, 'no-such-skills-dir'))
      expect(names).toEqual([])
      expect(warn).toHaveBeenCalledTimes(1)
      expect(warn.mock.calls[0]?.[0]).toContain('no-such-skills-dir')
    } finally {
      warn.mockRestore()
    }
  })
})

describe('wireAgenthoodConfig', () => {
  const paths = { skillsPath: '/pkg/skills', instructionsPath: '/pkg/AGENTS.md' }

  it('wires a fresh config', () => {
    const cfg: PluginConfig = {}
    wireAgenthoodConfig(cfg, paths, () => true)
    expect(cfg.skills?.paths).toEqual(['/pkg/skills'])
    expect(cfg.instructions).toEqual(['/pkg/AGENTS.md'])
    expect(cfg.agent?.['agenthood-live']?.mode).toBe('primary')
    expect(cfg.agent?.['agenthood-live']?.description).toBeTruthy()
    expect(cfg.agent?.['the-steward']).toBeUndefined()
  })

  it('is idempotent and preserves existing entries', () => {
    const cfg: PluginConfig = {
      skills: { paths: ['/other'], urls: ['https://x'] },
      instructions: ['/other/START.md'],
      agent: { build: { description: 'b' } },
    }
    wireAgenthoodConfig(cfg, paths, () => true)
    wireAgenthoodConfig(cfg, paths, () => true)
    expect(cfg.skills?.paths).toEqual(['/other', '/pkg/skills'])
    expect(cfg.skills?.urls).toEqual(['https://x'])
    expect(cfg.instructions).toEqual(['/other/START.md', '/pkg/AGENTS.md'])
    expect(cfg.agent?.build).toEqual({ description: 'b' })
    expect(cfg.agent?.['agenthood-live']?.mode).toBe('primary')
  })

  it('skips instructions when the file is absent', () => {
    const cfg: PluginConfig = {}
    wireAgenthoodConfig(cfg, paths, () => false)
    expect(cfg.instructions).toBeUndefined()
    expect(cfg.skills?.paths).toEqual(['/pkg/skills'])
  })

  it('refreshes a stale live entry', () => {
    const cfg: PluginConfig = { agent: { 'agenthood-live': { description: 'old', mode: 'subagent' } } }
    wireAgenthoodConfig(cfg, paths, () => false)
    expect(cfg.agent?.['agenthood-live']?.mode).toBe('primary')
    expect(cfg.agent?.['agenthood-live']?.description).toContain('end-to-end')
  })

  it('validates permission shape at runtime', () => {
    const cfg: PluginConfig = {}
    const paths = { skillsPath: '/pkg/skills', instructionsPath: '/pkg/AGENTS.md' }
    // Should not throw with valid permission shape
    wireAgenthoodConfig(cfg, paths, () => true)
    const perm = cfg.agent?.['agenthood-live']?.permission as Record<string, unknown> | undefined
    expect(perm).toBeDefined()
    expect(perm?.task).toEqual({ 'the-*': 'allow', '*': 'deny' })
    expect(perm?.skill).toEqual({ 'the-*': 'allow' })
    expect(perm?.edit).toBe('allow')
    expect(perm?.bash).toBe('allow')
  })
})

describe('appendCapped', () => {
  it('caps once and drops further chunks without extra markers', () => {
    const capped = appendCapped('abc', Buffer.from('defgh'), 5, 'output')
    expect(capped).toBe('abcde\n[output truncated]')
    expect(appendCapped(capped, Buffer.from('more'), 5, 'output')).toBe(capped)
  })

  it('passes through under the cap and at the exact boundary', () => {
    expect(appendCapped('ab', Buffer.from('cd'), 10, 'output')).toBe('abcd')
    expect(appendCapped('ab', Buffer.from('cd'), 4, 'output')).toBe('abcd')
  })
})

describe('collectOutput', () => {
  it('resolves buffered streams on close', async () => {
    const child = fakeChild() as any
    const pending = collectOutput(child, new AbortController().signal)
    child.stdout.emit('data', Buffer.from('hello '))
    child.stderr.emit('data', Buffer.from('warn'))
    child.stdout.emit('data', Buffer.from('world'))
    child.emit('close', 0)
    await expect(pending).resolves.toEqual({ stdout: 'hello world', stderr: 'warn', code: 0 })
  })

  it('surfaces spawn errors with a null code and ignores the follow-up close', async () => {
    const child = fakeChild() as any
    const pending = collectOutput(child, new AbortController().signal)
    child.emit('error', new Error('ENOENT'))
    child.emit('close', -2)
    await expect(pending).resolves.toEqual({ stdout: '', stderr: '', code: null, spawnError: 'ENOENT' })
  })

  it('kills the child when aborted', async () => {
    const child = fakeChild() as any
    let killed = false
    child.kill = () => {
      killed = true
      return true
    }
    const controller = new AbortController()
    const pending = collectOutput(child, controller.signal)
    controller.abort()
    child.emit('close', null)
    await pending
    expect(killed).toBe(true)
  })

  it('does not kill after the run already settled', async () => {
    const child = fakeChild() as any
    let kills = 0
    child.kill = () => {
      kills += 1
      return true
    }
    const controller = new AbortController()
    const pending = collectOutput(child, controller.signal)
    child.emit('close', 0)
    await pending
    controller.abort()
    await Promise.resolve()
    expect(kills).toBe(0)
  })

  it('tolerates a child without stdio streams', async () => {
    const bare = new EventEmitter()
    const pending = collectOutput(bare as never, new AbortController().signal)
    bare.emit('close', 0)
    await expect(pending).resolves.toEqual({ stdout: '', stderr: '', code: 0 })
  })
})

describe('formatRunResult', () => {
  it('keeps spawn failures as plain text', () => {
    expect(formatRunResult({ stdout: '', stderr: '', code: null, spawnError: 'ENOENT' })).toBe(
      'failed to spawn agenthood: ENOENT',
    )
  })

  it('reports empty output and omits clean exits', () => {
    expect(formatRunResult({ stdout: '  ', stderr: '', code: 0 })).toBe('no output')
    expect(formatRunResult({ stdout: 'ok', stderr: '', code: null })).toBe('ok')
  })

  it('appends stderr and non-zero exit codes', () => {
    expect(formatRunResult({ stdout: 'ok', stderr: 'warn', code: 3 })).toBe('ok\n[stderr]\nwarn\n[exit code 3]')
  })
})

describe('parseRedisTarget', () => {
  it('returns null when unset, blank, or malformed', () => {
    expect(parseRedisTarget(undefined)).toBeNull()
    expect(parseRedisTarget('')).toBeNull()
    expect(parseRedisTarget('   ')).toBeNull()
    expect(parseRedisTarget('db:abc')).toBeNull()
    expect(parseRedisTarget('db:0')).toBeNull()
    expect(parseRedisTarget('db:99999')).toBeNull()
  })

  it('defaults the port and parses host:port', () => {
    expect(parseRedisTarget('localhost')).toEqual({ host: 'localhost', port: 6379 })
    expect(parseRedisTarget('localhost:6380')).toEqual({ host: 'localhost', port: 6380 })
  })

  describe('host allowlist (local/trusted-network only)', () => {
    it('allows localhost', () => {
      expect(parseRedisTarget('localhost:6379')).toEqual({ host: 'localhost', port: 6379 })
    })

    it('allows 127.0.0.1', () => {
      expect(parseRedisTarget('127.0.0.1:6379')).toEqual({ host: '127.0.0.1', port: 6379 })
    })

    it('allows ::1 (IPv6 loopback) with bracket notation', () => {
      expect(parseRedisTarget('[::1]:6379')).toEqual({ host: '::1', port: 6379 })
    })

    it('allows host.docker.internal (Docker Desktop)', () => {
      expect(parseRedisTarget('host.docker.internal:6379')).toEqual({ host: 'host.docker.internal', port: 6379 })
    })

    it('rejects remote hostnames', () => {
      expect(parseRedisTarget('remote-host:6379')).toBeNull()
      expect(parseRedisTarget('redis.example.com:6379')).toBeNull()
    })

    it('rejects private IPs outside loopback', () => {
      expect(parseRedisTarget('192.168.1.50:6379')).toBeNull()
      expect(parseRedisTarget('10.0.0.1:6379')).toBeNull()
      expect(parseRedisTarget('172.16.0.1:6379')).toBeNull()
    })

    it('rejects public IPs', () => {
      expect(parseRedisTarget('8.8.8.8:6379')).toBeNull()
      expect(parseRedisTarget('1.1.1.1:6379')).toBeNull()
    })
  })
})

describe('mirrorRunRecord', () => {
  const record: RunRecord = { id: 'r1', member: 'the-scribe', task: 't', outcome: 'o', timestamp: 'ts' }

  const fakeSocket = () => {
    const emitter = new EventEmitter()
    const written: Buffer[] = []
    const socket: RedisSocket = {
      write: (chunk: Buffer) => {
        written.push(chunk)
      },
      once: (event: string, listener: (...args: unknown[]) => void) => {
        emitter.once(event, listener)
      },
      on: (event: string, listener: (...args: unknown[]) => void) => {
        emitter.on(event, listener)
      },
      destroy: () => {},
    }
    return { socket, written, emitter }
  }

  it('pipelines HSET + LPUSH and resolves true on +OK', async () => {
    const { socket, written, emitter } = fakeSocket()
    const pending = mirrorRunRecord({ host: 'h', port: 1 }, record, () => socket)
    emitter.emit('data', Buffer.from('+OK\r\n+OK\r\n'))
    await expect(pending).resolves.toBe(true)
    const wire = Buffer.concat(written).toString('utf8')
    expect(wire).toContain('agenthood:decisions:r1')
    expect(wire).toContain('LPUSH')
  })

  it('resolves false on error replies and socket errors', async () => {
    const first = fakeSocket()
    const pendingErr = mirrorRunRecord({ host: 'h', port: 1 }, record, () => first.socket)
    first.emitter.emit('data', Buffer.from('-ERR boom\r\n'))
    await expect(pendingErr).resolves.toBe(false)

    const second = fakeSocket()
    const pendingSocket = mirrorRunRecord({ host: 'h', port: 1 }, record, () => second.socket)
    second.emitter.emit('error', new Error('ECONNREFUSED'))
    await expect(pendingSocket).resolves.toBe(false)
  })

  it('resolves false when connecting throws', async () => {
    await expect(
      mirrorRunRecord({ host: 'h', port: 1 }, record, () => {
        throw new Error('nope')
      }),
    ).resolves.toBe(false)
  })

  it('sends AUTH first when a password is given', async () => {
    const { socket, written, emitter } = fakeSocket()
    const pending = mirrorRunRecord({ host: 'h', port: 1 }, record, () => socket, 'pw')
    emitter.emit('data', Buffer.from('+OK\r\n+OK\r\n+OK\r\n'))
    await expect(pending).resolves.toBe(true)
    const wire = Buffer.concat(written).toString('utf8')
    expect(wire.indexOf('AUTH')).toBeLessThan(wire.indexOf('HSET'))
  })

  it('resolves false when AUTH is rejected', async () => {
    const { socket, emitter } = fakeSocket()
    const pending = mirrorRunRecord({ host: 'h', port: 1 }, record, () => socket, 'wrong')
    emitter.emit('data', Buffer.from('-WRONGPASS\r\n'))
    await expect(pending).resolves.toBe(false)
  })
})

describe('buildRunMemberTool', () => {
  it('registers nothing when no members ship', () => {
    expect(buildRunMemberTool([])).toEqual({})
  })

  it('registers the member tool for shipped members', () => {
    const tools = buildRunMemberTool(['the-oracle'])
    expect(Object.keys(tools)).toEqual(['agenthood_run_member'])
    expect(tools.agenthood_run_member.description).toContain('the-oracle')
  })
})

describe('shipped skills and prompts', () => {
  it('every registry member ships a SKILL.md with matching name, description, and prompt body', () => {
    expect(rawSpecs.length).toBeGreaterThan(0)
    for (const spec of rawSpecs) {
      const { front, body } = parseSkill(join(repoRoot, 'skills', spec.name, 'SKILL.md'))
      expect(front.name).toBe(spec.name)
      expect(front.description?.length ?? 0).toBeGreaterThan(0)
      expect(body.trim().length).toBeGreaterThan(50)
      expect(body).toContain('#')
    }
  })

  it('AGENTS.md instructions file exists with prompt content', () => {
    const body = readFileSync(join(repoRoot, 'AGENTS.md'), 'utf8')
    expect(body.trim().length).toBeGreaterThan(50)
  })

  it('plugin live wiring matches the project opencode.json', async () => {
    const project = JSON.parse(readFileSync(join(repoRoot, 'opencode.json'), 'utf8'))
    const hooks = await (pluginModule.server as any)()
    const cfg: PluginConfig = {}
    await hooks.config?.(cfg)
    expect(cfg.agent?.['agenthood-live']).toEqual(project.agent['agenthood-live'])
  })
})

describe('opencode agent sync', () => {
  it('generates one valid single-frontmatter agent per registry member', async () => {
    const { mkdtemp, rm } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')
    const dir = await mkdtemp(join(tmpdir(), 'agents-'))
    try {
      const written = syncOpencodeAgents(repoRoot, dir)
      expect(written).toEqual(rawSpecs.map((s) => `${s.name}.md`).sort())
      for (const file of written) {
        const raw = readFileSync(join(dir, file), 'utf8')
        const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
        expect(match, file).toBeTruthy()
        expect(match?.[1]).toContain('mode: subagent')
        expect(match?.[1]).toContain('description:')
      }
      const live = syncLiveAgent(dir)
      expect(live).toBe('agenthood-live.md')
      const liveRaw = readFileSync(join(dir, live), 'utf8')
      const liveMatch = liveRaw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
      expect(liveMatch?.[1]).toContain('mode: primary')
      expect(liveMatch?.[1]).toContain('task:')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('package root resolves to the opencode plugin (never the CLI)', () => {
  it('main and exports["."] point at dist/opencode-plugin.js', () => {
    // Bare `agenthood` must load the plugin: the old `./dist/cli.js` target
    // printed HELP_TEXT and exited the host process on import (opencode died
    // showing the member list instead of starting).
    const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
      main: string
      exports: Record<string, string>
    }
    expect(pkg.main).toBe('./dist/opencode-plugin.js')
    expect(pkg.exports['.']).toBe('./dist/opencode-plugin.js')
    expect(pkg.exports['./server']).toBe('./dist/opencode-plugin.js')
  })

  it('importing the CLI module has no side effects (no help dump, no exit)', async () => {
    await import('../../src/cli.ts')
  })
})
