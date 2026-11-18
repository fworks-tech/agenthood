/**
 * src/opencode-plugin.ts
 *
 * Official opencode V2 plugin entrypoint. Load it from opencode config:
 *
 *   { "plugins": ["agenthood"] }
 *
 * It registers the Society's member skills and `agenthood_run_member`, a tool that
 * runs a member as a real runtime agent (enforced behavior + audit trail) instead
 * of free-styling from the skill text. The CLI (`dist/cli.js`) is spawned as-is.
 * An `execute.after` tool hook mirrors each member run to Redis when
 * AGENTHOOD_REDIS=host[:port] is set (unset means file-only audit), with the
 * optional AGENTHOOD_REDIS_PASSWORD sent as RESP AUTH first.
 *
 * The `agenthood-live` agent is not registered here: the V2 plugin API cannot
 * create agents, so it comes from the `agents` block in `opencode.json`.
 */

import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { connect } from 'node:net'
import type { Socket } from 'node:net'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { Plugin, Skill } from '@opencode/plugin'
import { rawSpecs } from './members/member-specs.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
// dist/opencode-plugin.js (or src/opencode-plugin.ts) -> package root
const PACKAGE_ROOT = join(__dirname, '..')
const CLI = join(PACKAGE_ROOT, 'dist', 'cli.js')

export interface DirectoryEntry {
  name: string
  isDirectory: () => boolean
}

export interface MemberDiscoveryFileSystem {
  readdir: (path: string) => DirectoryEntry[]
  exists: (path: string) => boolean
  warn: (message: string) => void
}

// Members are the registry (member-specs), matched against the shipped skills dir
// so the enum cannot drift from what is published. Defensive: a partial install
// must not crash plugin load: setup() skips tool registration when none are found.
export function discoverMemberNames(
  skillsDir: string,
  fs: MemberDiscoveryFileSystem = {
    readdir: (path) => readdirSync(path, { withFileTypes: true }),
    exists: existsSync,
    warn: (message) => console.warn(message),
  },
): string[] {
  const members = new Set(rawSpecs.map((spec) => spec.name))
  try {
    return fs
      .readdir(skillsDir)
      .filter((entry) => entry.isDirectory() && members.has(entry.name) && fs.exists(join(skillsDir, entry.name, 'SKILL.md')))
      .map((entry) => entry.name)
      .sort()
  } catch (err) {
    fs.warn(`[agenthood] skills dir unreadable (${skillsDir}), member tool disabled: ${err instanceof Error ? err.message : String(err)}`)
    return []
  }
}

// Computed lazily so importing the plugin never pays for the fs scan when the
// tool is never registered (memoized per process).
let cachedMemberNames: string[] | undefined
export function getMemberNames(): string[] {
  cachedMemberNames ??= discoverMemberNames(join(PACKAGE_ROOT, 'skills'))
  return cachedMemberNames
}

export function memberSkills(skillsDir: string, names: string[]): Skill.Info[] {
  return names.map((name) => {
    const path = join(skillsDir, name, 'SKILL.md')
    const content = readFileSync(path, 'utf8')
    const description = content.match(/^description:\s*(.+)$/m)?.[1]?.trim()
    return {
      id: Skill.ID.make(name),
      name: Skill.Name.make(name),
      description,
      autoinvoke: false,
      path: Skill.Info.fields.path.make(path),
      content,
    }
  })
}

// Caps so one runaway member run cannot flood the session context.
const MAX_OUTPUT = 200_000
const MAX_STDERR = 16_000

export function appendCapped(current: string, chunk: Buffer, max: number, label: string): string {
  // idempotent: once capped, further chunks are dropped without re-slicing
  // or appending another marker
  if (current.endsWith(`[${label} truncated]`)) return current
  const next = current + chunk.toString()
  return next.length > max ? `${next.slice(0, max)}\n[${label} truncated]` : next
}

export interface CollectedOutput {
  stdout: string
  stderr: string
  code: number | null
  spawnError?: string
  timedOut?: boolean
}

const DEFAULT_RUN_TIMEOUT_MS = 60_000

/** Collects a spawned member run's stdout/stderr until close, spawn error, or timeout. */
export function collectOutput(child: ChildProcess, abort: AbortSignal, timeoutMs = DEFAULT_RUN_TIMEOUT_MS): Promise<CollectedOutput> {
  return new Promise((resolve) => {
    const onAbort = () => child.kill()
    abort.addEventListener('abort', onAbort, { once: true })
    // `error` and `close` can both fire for one spawn failure; settle once
    let isSettled = false
    const done = (result: CollectedOutput) => {
      if (isSettled) return
      isSettled = true
      clearTimeout(watchdog)
      abort.removeEventListener('abort', onAbort)
      resolve(result)
    }

    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout = appendCapped(stdout, chunk, MAX_OUTPUT, 'output')
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr = appendCapped(stderr, chunk, MAX_STDERR, 'stderr')
    })
    child.on('close', (code) => done({ stdout, stderr, code }))
    child.on('error', (err) => done({ stdout, stderr, code: null, spawnError: err.message }))
    // watchdog: a CLI whose streams never close must not hang the tool call.
    // `done` runs only from async events after this declaration executes.
    const watchdog = setTimeout(() => {
      child.kill()
      done({ stdout, stderr, code: null, timedOut: true })
    }, timeoutMs)
  })
}

export function formatRunResult({ stdout, stderr, code, spawnError, timedOut }: CollectedOutput): string {
  // spawn failures keep the historical plain-text format (no [stderr] wrapper)
  if (spawnError) return `failed to spawn agenthood: ${spawnError}`
  const body = stdout.trim() || 'no output'
  const err = stderr.trim() ? `\n[stderr]\n${stderr.trim()}` : ''
  if (timedOut) return `${body}${err}\n[timed out]`
  const status = typeof code === 'number' && code !== 0 ? `\n[exit code ${code}]` : ''
  return `${body}${err}${status}`
}

export interface RunMemberDependencies {
  existsCli: (path: string) => boolean
  spawnProcess: (command: string, args: string[], options: { cwd: string }) => ChildProcess
}

export interface RunMemberOptions {
  directory: string
  abort: AbortSignal
  dependencies: RunMemberDependencies
  timeoutMs?: number
}

/**
 * The V2 host runs plugins on Bun, where process.execPath is the host binary
 * instead of Node. The Agenthood CLI is a Node script, so fall back to node on
 * PATH (or AGENTHOOD_NODE) when the host runtime is something else.
 */
export function nodeRuntime(execPath: string = process.execPath, env: NodeJS.ProcessEnv = process.env): string {
  return /(^|[\\/])node(?:\.exe)?$/i.test(execPath) ? execPath : env.AGENTHOOD_NODE || 'node'
}

/** Runs `agenthood run <member> "<task>"` in the caller's project and streams the result. */
export async function runMember(member: string, task: string, options: RunMemberOptions): Promise<string> {
  if (!options.dependencies.existsCli(CLI)) return `agenthood CLI not found at ${CLI}: run \`npm run build\` in the agenthood package.`

  // `--` keeps a task beginning with `-` as data: the CLI would otherwise
  // parse `--detect` / `--provider` out of it
  const child = options.dependencies.spawnProcess(nodeRuntime(), [CLI, 'run', member, '--', task], { cwd: options.directory })
  return formatRunResult(await collectOutput(child, options.abort, options.timeoutMs ?? DEFAULT_RUN_TIMEOUT_MS))
}

const memberRunDependencies: RunMemberDependencies = {
  existsCli: existsSync,
  spawnProcess: (command, args, options) => spawn(command, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] }),
}

export function runMemberTool(names: string[], directory: string) {
  return {
    name: 'agenthood_run_member',
    description:
      'Run an Agenthood Society member as a real agent on a task (enforced behavior + audit trail). '
      + `Members: ${names.join(', ')}. `
      + 'Use steward to route ambiguous tasks to the minimal member set first.',
    input: z.object({
      member: z.enum(names as [string, ...string[]]),
      task: z.string().describe('Task for the member, e.g. "write a commit message for the current diff"'),
    }),
    execute: async ({ member, task }: { member: string; task: string }, context: { signal: AbortSignal }) => ({
      content: await runMember(member, task, { directory, abort: context.signal, dependencies: memberRunDependencies }),
      metadata: { title: `agenthood run ${member}` },
    }),
  }
}

export interface RedisTarget {
  host: string
  port: number
}

const DEFAULT_REDIS_PORT = 6379
const REDIS_TIMEOUT_MS = 2000
const MAX_OUTCOME_CHARS = 500

// AGENTHOOD_REDIS=host[:port] mirrors member runs to Redis; unset means
// file-only audit (zero-infra default). Malformed values disable mirroring.
// Only local/trusted-network hosts are allowed to prevent plaintext AUTH
// over untrusted networks. Allowed: localhost, 127.0.0.1, ::1, host.docker.internal.
const ALLOWED_REDIS_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'host.docker.internal'])

function splitHostPort(raw: string): { host: string; portRaw: string | undefined } | null {
  // Handle IPv6 addresses like [::1]:6379 or ::1:6379
  const trimmed = raw.trim()
  if (trimmed.startsWith('[')) {
    // [host]:port format
    const bracketEnd = trimmed.indexOf(']')
    if (bracketEnd === -1) return null
    const host = trimmed.slice(1, bracketEnd)
    const rest = trimmed.slice(bracketEnd + 1)
    const portRaw = rest.startsWith(':') ? rest.slice(1) : undefined
    return { host, portRaw }
  }
  // IPv4 or hostname: split on last colon
  const lastColon = trimmed.lastIndexOf(':')
  if (lastColon === -1) {
    return { host: trimmed, portRaw: undefined }
  }
  const host = trimmed.slice(0, lastColon)
  const portRaw = trimmed.slice(lastColon + 1)
  return { host, portRaw }
}

export function parseRedisTarget(raw: string | undefined): RedisTarget | null {
  if (!raw || raw.trim().length === 0) return null
  const split = splitHostPort(raw)
  if (!split) return null
  const { host, portRaw } = split
  if (!host) return null
  if (!ALLOWED_REDIS_HOSTS.has(host)) return null
  if (portRaw === undefined) return { host, port: DEFAULT_REDIS_PORT }
  const port = Number(portRaw)
  if (!Number.isInteger(port) || port <= 0 || port > 65535) return null
  return { host, port }
}

export interface RunRecord {
  id: string
  member: string
  task: string
  outcome: string
  timestamp: string
}

export interface RedisSocket {
  write(chunk: Buffer): void
  once(event: string, listener: (...args: unknown[]) => void): void
  on(event: string, listener: (...args: unknown[]) => void): void
  destroy(): void
}

export type RedisConnect = (target: RedisTarget) => RedisSocket

function respCommand(args: string[]): Buffer {
  const parts: Buffer[] = [Buffer.from(`*${args.length}\r\n`)]
  for (const arg of args) {
    const bytes = Buffer.from(arg, 'utf8')
    parts.push(Buffer.from(`$${bytes.length}\r\n`), bytes, Buffer.from('\r\n'))
  }
  return Buffer.concat(parts)
}

// Minimal RESP client (bulk strings only, pipelined HSET + LPUSH). Fail-silent
// by contract: the audit mirror must never break the session it observes.
export async function mirrorRunRecord(
  target: RedisTarget,
  record: RunRecord,
  openSocket: RedisConnect = (t) => connect(t.port, t.host) as Socket,
  auth?: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false
    let socket: RedisSocket
    try {
      socket = openSocket(target)
    } catch {
      resolve(false)
      return
    }
    const done = (ok: boolean) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      socket.destroy()
      resolve(ok)
    }
    const timer = setTimeout(() => done(false), REDIS_TIMEOUT_MS)
    let buffer = ''
    let replies = 0
    const expected = auth ? 3 : 2
    socket.once('error', () => done(false))
    socket.on('data', (chunk: unknown) => {
      buffer += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk)
      let idx: number
      while ((idx = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, idx)
        buffer = buffer.slice(idx + 2)
        replies += 1
        if (line.startsWith('-')) {
          done(false)
          return
        }
        if (replies >= expected) {
          done(true)
          return
        }
      }
    })
    const outcome = record.outcome.slice(0, MAX_OUTCOME_CHARS)
    const commands = auth ? [respCommand(['AUTH', auth])] : []
    commands.push(
      respCommand(['HSET', `agenthood:decisions:${record.id}`, 'member', record.member, 'task', record.task, 'outcome', outcome, 'timestamp', record.timestamp]),
      respCommand(['LPUSH', 'agenthood:decisions:log', record.id]),
    )
    socket.write(Buffer.concat(commands))
  })
}

export default Plugin.define({
  id: 'agenthood',
  async setup(ctx) {
    const names = getMemberNames()
    await ctx.skill.transform((editor) => {
      for (const skill of memberSkills(join(PACKAGE_ROOT, 'skills'), names)) editor.add(skill)
    })
    if (names.length > 0) {
      await ctx.tool.transform((editor) => {
        editor.add(runMemberTool(names, ctx.location.directory))
      })
    }
    await ctx.tool.hook('execute.after', async (event) => {
      if (event.tool !== 'agenthood_run_member') return
      const target = parseRedisTarget(process.env.AGENTHOOD_REDIS)
      if (!target) return
      const args = (event.input ?? {}) as { member?: unknown; task?: unknown }
      await mirrorRunRecord(
        target,
        {
          id: randomUUID(),
          member: typeof args.member === 'string' ? args.member : 'unknown',
          task: typeof args.task === 'string' ? args.task : '',
          outcome: 'agenthood_run_member completed',
          timestamp: new Date().toISOString(),
        },
        undefined,
        process.env.AGENTHOOD_REDIS_PASSWORD,
      )
    })
  },
})
