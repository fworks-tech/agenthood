import { describe, it, expect, vi, beforeEach } from 'vitest'
import pluginModule, { runMember } from '../../src/opencode-plugin.ts'
import type { FakeChild } from '../helpers/opencodePluginFixtures.ts'
import { fakeChild } from '../helpers/opencodePluginFixtures.ts'

const state = vi.hoisted(() => ({
  cliExists: true,
  spawnChild: null as null | FakeChild,
  spawnCalls: [] as Array<{ command: string; args: string[]; options: { cwd: string } }>,
}))

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>()
  return {
    ...actual,
    spawn: (command: string, args: string[], options: { cwd: string }) => {
      state.spawnCalls.push({ command, args, options })
      if (!state.spawnChild) throw new Error('spawn not stubbed for this test')
      return state.spawnChild
    },
  }
})

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    existsSync: (p: Parameters<typeof actual.existsSync>[0]) =>
      typeof p === 'string' && p.replace(/\\/g, '/').endsWith('dist/cli.js') ? state.cliExists : actual.existsSync(p),
  }
})

beforeEach(() => {
  state.cliExists = true
  state.spawnChild = null
  state.spawnCalls = []
})

describe('runMember', () => {
  const deps = (overrides: Partial<{ existsCli: () => boolean; spawnProcess: () => FakeChild }> = {}) => ({
    existsCli: overrides.existsCli ?? (() => true),
    spawnProcess:
      overrides.spawnProcess ??
      (() => {
        throw new Error('must not spawn')
      }),
  })

  it('reports a missing CLI without spawning', async () => {
    let spawned = false
    const out = await runMember('the-oracle', 'task', {
      directory: '/proj',
      abort: new AbortController().signal,
      dependencies: {
        existsCli: () => false,
        spawnProcess: () => {
          spawned = true
          return fakeChild() as never
        },
      },
    })
    expect(spawned).toBe(false)
    expect(out).toContain('agenthood CLI not found')
  })

  it('spawns the CLI in the caller directory and formats the result', async () => {
    const child = fakeChild()
    let seen: { command: string; args: string[]; options: { cwd: string } } | undefined
    const out = await runMember('the-oracle', 'do it', {
      directory: '/proj',
      abort: new AbortController().signal,
      dependencies: {
        existsCli: () => true,
        spawnProcess: (command, args, options) => {
          seen = { command, args, options }
          setImmediate(() => {
            child.stdout.emit('data', Buffer.from('all good'))
            child.stderr.emit('data', Buffer.from('note'))
            child.emit('close', 2)
          })
          return child as never
        },
      },
    })
    expect(seen?.args.slice(-4)).toEqual(['run', 'the-oracle', '--', 'do it'])
    expect(seen?.options).toEqual({ cwd: '/proj' })
    expect(out).toBe('all good\n[stderr]\nnote\n[exit code 2]')
  })

  it('keeps spawn failures as plain text', async () => {
    const child = fakeChild()
    const out = await runMember('the-oracle', 'task', {
      directory: '/proj',
      abort: new AbortController().signal,
      dependencies: {
        existsCli: () => true,
        spawnProcess: () => {
          setImmediate(() => {
            child.emit('error', new Error('boom'))
            child.emit('close', -2)
          })
          return child as never
        },
      },
    })
    expect(out).toBe('failed to spawn agenthood: boom')
  })

  it('uses the injected existence check and spawner', async () => {
    const child = fakeChild()
    const checked: string[] = []
    const out = await runMember(
      'the-oracle',
      'task',
      {
        directory: '/proj',
        abort: new AbortController().signal,
        dependencies: deps({
          existsCli: () => {
            checked.push('cli')
            return true
          },
          spawnProcess: () => {
            setImmediate(() => child.emit('close', 0))
            return child
          },
        }),
      },
    )
    expect(checked).toEqual(['cli'])
    expect(out).toBe('no output')
  })

  it('keeps a leading-dash task as data behind --', async () => {
    const child = fakeChild()
    let seen: { args: string[] } | undefined
    await runMember('the-oracle', '--detect this looks like a flag', {
      directory: '/proj',
      abort: new AbortController().signal,
      dependencies: {
        existsCli: () => true,
        spawnProcess: (_command, args) => {
          seen = { args }
          setImmediate(() => child.emit('close', 0))
          return child as never
        },
      },
    })
    expect(seen?.args.slice(-4)).toEqual(['run', 'the-oracle', '--', '--detect this looks like a flag'])
  })

  it('kills and reports a CLI that never closes', async () => {
    const child = fakeChild()
    let killed = false
    child.kill = () => {
      killed = true
      return true
    }
    const out = await runMember('the-oracle', 'task', {
      directory: '/proj',
      abort: new AbortController().signal,
      timeoutMs: 20,
      dependencies: deps({
        existsCli: () => true,
        spawnProcess: () => child,
      }),
    })
    expect(killed).toBe(true)
    expect(out).toContain('[timed out]')
  })
})

describe('server tool execute', () => {
  it('runs the member in the caller directory through the mocked spawn', async () => {
    const child = fakeChild()
    state.spawnChild = child
    const hooks = await pluginModule.server()
    const def = hooks.tool?.['agenthood_run_member']
    setImmediate(() => {
      child.stdout.emit('data', Buffer.from('member says hi'))
      child.emit('close', 0)
    })
    const result = await def?.execute(
      { member: 'the-oracle', task: 'hi' },
      { directory: '/caller', abort: new AbortController().signal } as never,
    )
    expect(result).toEqual({ title: 'agenthood run the-oracle', output: 'member says hi' })
    expect(state.spawnCalls[0]?.args.slice(-4)).toEqual(['run', 'the-oracle', '--', 'hi'])
    expect(state.spawnCalls[0]?.options.cwd).toBe('/caller')
    expect(state.spawnCalls[0]?.options.stdio).toEqual(['ignore', 'pipe', 'pipe'])
  })

  it('reports a missing CLI without spawning', async () => {
    state.cliExists = false
    const hooks = await pluginModule.server()
    const def = hooks.tool?.['agenthood_run_member']
    const result = await def?.execute(
      { member: 'the-oracle', task: 'hi' },
      { directory: '/caller', abort: new AbortController().signal } as never,
    )
    expect(result).toEqual({
      title: 'agenthood run the-oracle',
      output: expect.stringContaining('agenthood CLI not found'),
    })
    expect(state.spawnCalls).toEqual([])
  })
})
