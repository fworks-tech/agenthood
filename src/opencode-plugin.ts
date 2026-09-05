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
import type { Config, Hooks, Plugin, PluginModule, ToolContext, ToolResult } from '@opencode-ai/plugin'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
// dist/opencode-plugin.js (or src/opencode-plugin.ts) -> package root
const PACKAGE_ROOT = join(__dirname, '..')
const CLI = join(PACKAGE_ROOT, 'dist', 'cli.js')

// The SDK Config type predates the `skills` config block; the live merged
// config opencode passes to the hook does carry it.
type PluginConfig = Config & { skills?: { paths?: string[]; urls?: string[] } }

// Derived from the shipped skills dir so the enum cannot drift from the members
// actually published in the package. Defensive: a partial install must not
// crash plugin load — the server() guard below skips tool registration.
export const memberNames: string[] = (() => {
  try {
    const skillsDir = join(PACKAGE_ROOT, 'skills')
    return readdirSync(skillsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name.startsWith('the-') && existsSync(join(skillsDir, d.name, 'SKILL.md')))
      .map((d) => d.name)
      .sort()
  } catch (err) {
    console.warn(`[agenthood] skills dir unreadable, member tool disabled: ${err instanceof Error ? err.message : String(err)}`)
    return []
  }
})()

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
    let settled = false
    const done = (result: CollectedOutput) => {
      if (settled) return
      settled = true
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

/** Runs `agenthood run <member> "<task>"` in the caller's project and streams the result. */
async function runMember(member: string, task: string, directory: string, abort: AbortSignal): Promise<string> {
  if (!existsSync(CLI)) return `agenthood CLI not found at ${CLI} — run \`npm run build\` in the agenthood package.`

  const child = spawn(process.execPath, [CLI, 'run', member, task], {
    cwd: directory,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const { stdout, stderr, code, spawnError } = await collectOutput(child, abort)
  // spawn failures keep the historical plain-text format (no [stderr] wrapper)
  if (spawnError) return `failed to spawn agenthood: ${spawnError}`
  const body = stdout.trim() || 'no output'
  const err = stderr.trim() ? `\n[stderr]\n${stderr.trim()}` : ''
  const status = typeof code === 'number' && code !== 0 ? `\n[exit code ${code}]` : ''
  return `${body}${err}${status}`
}

const server: Plugin = async () => {
  const hooks: Hooks = {
    config: async (raw) => {
      const cfg = raw as PluginConfig
      cfg.skills ??= {}
      const skillsPath = join(PACKAGE_ROOT, 'skills')
      cfg.skills.paths = cfg.skills.paths ?? []
      if (!cfg.skills.paths.includes(skillsPath)) cfg.skills.paths.push(skillsPath)
      const instructionsPath = join(PACKAGE_ROOT, 'AGENTS.md')
      if (existsSync(instructionsPath)) {
        cfg.instructions = cfg.instructions ?? []
        if (!cfg.instructions.includes(instructionsPath)) cfg.instructions.push(instructionsPath)
      }
      cfg.agent ??= {}
      cfg.agent['the-steward'] = {
        description: 'Route tasks to the minimal set of Agenthood members. Start here for any Agenthood task.',
        mode: 'primary',
      }
    },
    tool: memberNames.length > 0
      ? {
          agenthood_run_member: {
            description:
              'Run an Agenthood Society member as a real agent on a task (enforced behavior + audit trail). '
              + `Members: ${memberNames.join(', ')}. `
              + 'Use the-steward to route ambiguous tasks to the minimal member set first.',
            args: {
              member: z.enum(memberNames as [string, ...string[]]),
              task: z.string().describe('Task for the member, e.g. "write a commit message for the current diff"'),
            },
            execute: async (
              { member, task }: { member: string; task: string },
              context: ToolContext,
            ): Promise<ToolResult> => ({
              title: `agenthood run ${member}`,
              output: await runMember(member, task, context.directory, context.abort),
            }),
          },
        }
      : {},
  }
  return hooks
}

export default { id: 'agenthood', server } satisfies PluginModule