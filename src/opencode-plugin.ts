/**
 * src/opencode-plugin.ts
 *
 * Official opencode plugin entrypoint. Lets the Agenthood Society load globally
 * via a single line in opencode config:
 *
 *   { "plugin": ["agenthood"] }
 *
 * The plugin wires what the repo's `opencode.json` wires locally — the skills
 * directory and AGENTS.md instructions — by mutating the merged config in the
 * `config` hook, plus a primary `agenthood-live` orchestrator agent. It also registers
 * `agenthood_run_member`, a tool that executes a Society member as a real
 * runtime agent (enforced behavior + audit trail) instead of free-styling from
 * the skill text. The CLI (`dist/cli.js`) is untouched and spawned as-is. A
 * `tool.execute.after` hook mirrors each member run to Redis when
 * AGENTHOOD_REDIS=host[:port] is set (unset means file-only audit), with the
 * optional AGENTHOOD_REDIS_PASSWORD sent as RESP AUTH first.
 *
 * opencode resolves this module via the package root (`exports["."]`, so
 * `{ "plugin": ["agenthood"] }` works) with `exports["./server"]` kept as an
 * alias. Requires a default export of `{ id, server }` (see
 * `@opencode-ai/plugin`'s `PluginModule`). Config is loaded once at startup,
 * not hot-reloaded: after installing the plugin, opencode must be restarted.
 */

import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, readdirSync } from 'node:fs'
import { connect } from 'node:net'
import type { Socket } from 'node:net'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import type { Config, Hooks, Plugin, PluginModule, ToolContext, ToolDefinition, ToolResult } from '@opencode-ai/plugin'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
// dist/opencode-plugin.js (or src/opencode-plugin.ts) -> package root
const PACKAGE_ROOT = join(__dirname, '..')
const CLI = join(PACKAGE_ROOT, 'dist', 'cli.js')

// The SDK Config type predates the `skills` config block; the live merged
// config opencode passes to the hook does carry it.
export type PluginConfig = Config & { skills?: { paths?: string[]; urls?: string[] } }

export interface AgenthoodConfigPaths {
  skillsPath: string
  instructionsPath: string
}

export interface DirectoryEntry {
  name: string
  isDirectory: () => boolean
}

export interface MemberDiscoveryFileSystem {
  readdir: (path: string) => DirectoryEntry[]
  exists: (path: string) => boolean
  warn: (message: string) => void
}

// Derived from the shipped skills dir so the enum cannot drift from the members
// actually published in the package. Defensive: a partial install must not
// crash plugin load — the server() guard below skips tool registration.
export function discoverMemberNames(
  skillsDir: string,
  fs: MemberDiscoveryFileSystem = {
    readdir: (path) => readdirSync(path, { withFileTypes: true }),
    exists: existsSync,
    warn: (message) => console.warn(message),
  },
): string[] {
  try {
    return fs
      .readdir(skillsDir)
      .filter((entry) => entry.isDirectory() && entry.name.startsWith('the-') && fs.exists(join(skillsDir, entry.name, 'SKILL.md')))
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

// Mutation is the opencode `config`-hook contract (the hook returns void);
// the includes-guards keep repeated invocations idempotent.
export function wireAgenthoodConfig(
  cfg: PluginConfig,
  paths: AgenthoodConfigPaths,
  hasInstructions: (path: string) => boolean = existsSync,
): void {
  cfg.skills ??= {}
  cfg.skills.paths = cfg.skills.paths ?? []
  if (!cfg.skills.paths.includes(paths.skillsPath)) cfg.skills.paths.push(paths.skillsPath)
  if (hasInstructions(paths.instructionsPath)) {
    cfg.instructions = cfg.instructions ?? []
    if (!cfg.instructions.includes(paths.instructionsPath)) cfg.instructions.push(paths.instructionsPath)
  }
  cfg.agent ??= {}
  // The SDK agent permission type predates the task/skill fan-out keys the
  // opencode docs describe, so the literal cannot satisfy it directly. Cast
  // locally; the keys pass through the merged JSON config untouched, same
  // rationale as skills.paths above.
  cfg.agent['agenthood-live'] = {
    description: 'Run the Agenthood Society end-to-end: orchestrate member subagents in parallel with a Redis audit trail. Start here for any Agenthood task.',
    mode: 'primary',
    permission: {
      task: { 'the-*': 'allow', '*': 'deny' },
      skill: { 'the-*': 'allow' },
      edit: 'allow',
      bash: 'allow',
    },
  } as unknown as NonNullable<NonNullable<Config['agent']>[string]>
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

/** Runs `agenthood run <member> "<task>"` in the caller's project and streams the result. */
export async function runMember(member: string, task: string, options: RunMemberOptions): Promise<string> {
  if (!options.dependencies.existsCli(CLI)) return `agenthood CLI not found at ${CLI} — run \`npm run build\` in the agenthood package.`

  // `--` keeps a task beginning with `-` as data — the CLI would otherwise
  // parse `--detect` / `--provider` out of it
  const child = options.dependencies.spawnProcess(process.execPath, [CLI, 'run', member, '--', task], { cwd: options.directory })
  return formatRunResult(await collectOutput(child, options.abort, options.timeoutMs ?? DEFAULT_RUN_TIMEOUT_MS))
}

/** `agenthood_run_member` tool executor: spawns the CLI in the caller's project. */
export async function executeRunMember(
  { member, task }: { member: string; task: string },
  context: ToolContext,
): Promise<ToolResult> {
  return {
    title: `agenthood run ${member}`,
    output: await runMember(member, task, {
      directory: context.directory,
      abort: context.abort,
      dependencies: {
        existsCli: existsSync,
        spawnProcess: (command, args, options) => spawn(command, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] }),
      },
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
export function parseRedisTarget(raw: string | undefined): RedisTarget | null {
  if (!raw || raw.trim().length === 0) return null
  const [host, portRaw] = raw.trim().split(':')
  if (!host) return null
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

export function buildRunMemberTool(names: string[]): Record<string, ToolDefinition> {
  if (names.length === 0) return {}
  return {
    agenthood_run_member: {
      description:
        'Run an Agenthood Society member as a real agent on a task (enforced behavior + audit trail). '
        + `Members: ${names.join(', ')}. `
        + 'Use the-steward to route ambiguous tasks to the minimal member set first.',
      args: {
        member: z.enum(names as [string, ...string[]]),
        task: z.string().describe('Task for the member, e.g. "write a commit message for the current diff"'),
      },
      execute: executeRunMember,
    },
  }
}

const server: Plugin = async () => {
  const hooks: Hooks = {
    config: async (raw) => {
      const cfg = raw as PluginConfig
      wireAgenthoodConfig(cfg, {
        skillsPath: join(PACKAGE_ROOT, 'skills'),
        instructionsPath: join(PACKAGE_ROOT, 'AGENTS.md'),
      })
    },
    tool: buildRunMemberTool(getMemberNames()),
    'tool.execute.after': async (input) => {
      if (input.tool !== 'agenthood_run_member') return
      const target = parseRedisTarget(process.env.AGENTHOOD_REDIS)
      if (!target) return
      const args = (input.args ?? {}) as { member?: unknown; task?: unknown }
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
    },
  }
  return hooks
}

export default { id: 'agenthood', server } satisfies PluginModule
