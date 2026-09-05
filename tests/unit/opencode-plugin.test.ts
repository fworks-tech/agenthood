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
  memberNames,
  wireAgenthoodConfig,
} from '../../src/opencode-plugin.ts'
import type { PluginConfig } from '../../src/opencode-plugin.ts'
import { rawSpecs } from '../../src/members/member-specs.ts'
import { fakeChild, parseSkill, repoRoot } from '../helpers/opencodePluginFixtures.ts'

describe('agenthood opencode plugin', () => {
  it('default-exports a PluginModule with id and server', () => {
    expect(pluginModule.id).toBe('agenthood')
    expect(typeof pluginModule.server).toBe('function')
  })

  it('config hook wires the skills dir, AGENTS.md, and the-steward agent', async () => {
    const hooks = await pluginModule.server()
    const cfg: PluginConfig = {}
    await hooks.config?.(cfg)

    expect(cfg.skills?.paths?.some((p) => p.endsWith('skills'))).toBe(true)
    expect(cfg.instructions?.some((i) => i.endsWith('AGENTS.md'))).toBe(true)
    expect(cfg.agent?.['the-steward']?.mode).toBe('primary')
    expect(cfg.agent?.['the-steward']?.description).toBeTruthy()
  })

  it('registers agenthood_run_member with a member enum and task string', async () => {
    const hooks = await pluginModule.server()
    const def = hooks.tool?.['agenthood_run_member']
    expect(def).toBeDefined()
    expect(def?.description).toContain(memberNames.join(', '))
    expect(def?.args.member).toBeDefined()
    expect(def?.args.task).toBeDefined()
  })

  it('matches the member list against the canonical registry (single manifest)', () => {
    // Intentional direction: the registry is truth. A spec without a shipped
    // SKILL.md fails here on purpose — the tool enum derives from skills/ and
    // the two must stay in sync (a member with no skill file cannot run).
    const registryNames = rawSpecs.map((s) => s.name).sort()
    expect(memberNames).toEqual(registryNames)
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
    expect(discoverMemberNames(join(repoRoot, 'skills'))).toEqual(memberNames)
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
    expect(cfg.agent?.['the-steward']?.mode).toBe('primary')
    expect(cfg.agent?.['the-steward']?.description).toBeTruthy()
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
    expect(cfg.agent?.['the-steward']?.mode).toBe('primary')
  })

  it('skips instructions when the file is absent', () => {
    const cfg: PluginConfig = {}
    wireAgenthoodConfig(cfg, paths, () => false)
    expect(cfg.instructions).toBeUndefined()
    expect(cfg.skills?.paths).toEqual(['/pkg/skills'])
  })

  it('refreshes a stale steward entry', () => {
    const cfg: PluginConfig = { agent: { 'the-steward': { description: 'old', mode: 'subagent' } } }
    wireAgenthoodConfig(cfg, paths, () => false)
    expect(cfg.agent?.['the-steward']?.mode).toBe('primary')
    expect(cfg.agent?.['the-steward']?.description).toContain('minimal set')
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
    const child = fakeChild()
    const pending = collectOutput(child, new AbortController().signal)
    child.stdout.emit('data', Buffer.from('hello '))
    child.stderr.emit('data', Buffer.from('warn'))
    child.stdout.emit('data', Buffer.from('world'))
    child.emit('close', 0)
    await expect(pending).resolves.toEqual({ stdout: 'hello world', stderr: 'warn', code: 0 })
  })

  it('surfaces spawn errors with a null code and ignores the follow-up close', async () => {
    const child = fakeChild()
    const pending = collectOutput(child, new AbortController().signal)
    child.emit('error', new Error('ENOENT'))
    child.emit('close', -2)
    await expect(pending).resolves.toEqual({ stdout: '', stderr: '', code: null, spawnError: 'ENOENT' })
  })

  it('kills the child when aborted', async () => {
    const child = fakeChild()
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
    const child = fakeChild()
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

  it('plugin steward wiring matches the project opencode.json', async () => {
    const project = JSON.parse(readFileSync(join(repoRoot, 'opencode.json'), 'utf8'))
    const hooks = await pluginModule.server()
    const cfg: PluginConfig = {}
    await hooks.config?.(cfg)
    expect(cfg.agent?.['the-steward']).toEqual(project.agent['the-steward'])
  })
})
