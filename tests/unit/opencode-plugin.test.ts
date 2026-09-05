import { describe, it, expect } from 'vitest'
import { EventEmitter } from 'node:events'
import pluginModule, { appendCapped, collectOutput, memberNames } from '../../src/opencode-plugin.ts'
import { rawSpecs } from '../../src/members/member-specs.ts'
import type { Config } from '@opencode-ai/plugin'

describe('agenthood opencode plugin', () => {
  it('default-exports a PluginModule with id and server', () => {
    expect(pluginModule.id).toBe('agenthood')
    expect(typeof pluginModule.server).toBe('function')
  })

  it('config hook wires the skills dir, AGENTS.md, and the-steward agent', async () => {
    const hooks = await pluginModule.server()
    const cfg = {} as Config
    await hooks.config?.(cfg)

    const merged = cfg as Config & {
      skills?: { paths?: string[] }
      instructions?: string[]
      agent?: Record<string, { description?: string; mode?: string }>
    }
    expect(merged.skills?.paths?.some((p) => p.endsWith('skills'))).toBe(true)
    expect(merged.instructions?.some((i) => i.endsWith('AGENTS.md'))).toBe(true)
    expect(merged.agent?.['the-steward']?.mode).toBe('primary')
    expect(merged.agent?.['the-steward']?.description).toBeTruthy()
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

  it('appendCapped caps once and drops further chunks without extra markers', () => {
    const capped = appendCapped('abc', Buffer.from('defgh'), 5, 'output')
    expect(capped).toBe('abcde\n[output truncated]')
    expect(appendCapped(capped, Buffer.from('more'), 5, 'output')).toBe(capped)
  })

  it('appendCapped passes through under the cap', () => {
    expect(appendCapped('ab', Buffer.from('cd'), 10, 'output')).toBe('abcd')
  })

  function fakeChild(): EventEmitter & { stdout: EventEmitter; stderr: EventEmitter; kill: () => boolean } {
    const child = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter
      stderr: EventEmitter
      kill: () => boolean
    }
    child.stdout = new EventEmitter()
    child.stderr = new EventEmitter()
    child.kill = () => true
    return child
  }

  it('collectOutput resolves buffered streams on close', async () => {
    const child = fakeChild()
    const pending = collectOutput(child, new AbortController().signal)
    child.stdout.emit('data', Buffer.from('hello '))
    child.stderr.emit('data', Buffer.from('warn'))
    child.stdout.emit('data', Buffer.from('world'))
    child.emit('close', 0)
    await expect(pending).resolves.toEqual({ stdout: 'hello world', stderr: 'warn', code: 0 })
  })

  it('collectOutput surfaces spawn errors with a null code', async () => {
    const child = fakeChild()
    const pending = collectOutput(child, new AbortController().signal)
    child.emit('error', new Error('ENOENT'))
    child.emit('close', -2)
    await expect(pending).resolves.toEqual({ stdout: '', stderr: '', code: null, spawnError: 'ENOENT' })
  })

  it('collectOutput kills the child when aborted', async () => {
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
})
