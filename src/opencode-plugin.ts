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
 * `config` hook, plus a primary `the-steward` router agent. It also registers
 * `agenthood_run_member`, a tool that executes a Society member as a real
 * runtime agent (enforced behavior + audit trail) instead of free-styling from
 * the skill text. The CLI (`dist/cli.js`) is untouched and spawned as-is.
 *
 * opencode resolves this module via the package `exports["./server"]` and
 * requires a default export of `{ id, server }` (see `@opencode-ai/plugin`'s
 * `PluginModule`). Config is loaded once at startup, not hot-reloaded: after
 * installing the plugin, opencode must be restarted.
 */

import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
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

export const memberNames: string[] = discoverMemberNames(join(PACKAGE_ROOT, 'skills'))

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
  cfg.agent['the-steward'] = {
    description: 'Route tasks to the minimal set of Agenthood members. Start here for any Agenthood task.',
    mode: 'primary',
  }
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
}

/** Collects a spawned member run's stdout/stderr until close or spawn error. */
export function collectOutput(child: ChildProcess, abort: AbortSignal): Promise<CollectedOutput> {
  return new Promise((resolve) => {
    const onAbort = () => child.kill()
    abort.addEventListener('abort', onAbort, { once: true })
    // `error` and `close` can both fire for one spawn failure; settle once
    let isSettled = false
    const done = (result: CollectedOutput) => {
      if (isSettled) return
      isSettled = true
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
  })
}

export function formatRunResult({ stdout, stderr, code, spawnError }: CollectedOutput): string {
  // spawn failures keep the historical plain-text format (no [stderr] wrapper)
  if (spawnError) return `failed to spawn agenthood: ${spawnError}`
  const body = stdout.trim() || 'no output'
  const err = stderr.trim() ? `\n[stderr]\n${stderr.trim()}` : ''
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
}

/** Runs `agenthood run <member> "<task>"` in the caller's project and streams the result. */
export async function runMember(member: string, task: string, options: RunMemberOptions): Promise<string> {
  if (!options.dependencies.existsCli(CLI)) return `agenthood CLI not found at ${CLI} — run \`npm run build\` in the agenthood package.`

  const child = options.dependencies.spawnProcess(process.execPath, [CLI, 'run', member, task], { cwd: options.directory })
  return formatRunResult(await collectOutput(child, options.abort))
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
    tool: buildRunMemberTool(memberNames),
  }
  return hooks
}

export default { id: 'agenthood', server } satisfies PluginModule
