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
    return readdirSync(join(PACKAGE_ROOT, 'skills'))
      .filter((d) => d.startsWith('the-'))
      .sort()
  } catch {
    return []
  }
})()

/** Runs `agenthood run <member> "<task>"` in the caller's project and streams the result. */
async function runMember(member: string, task: string, directory: string, abort: AbortSignal): Promise<string> {
  if (!existsSync(CLI)) return `agenthood CLI not found at ${CLI} — run \`npm run build\` in the agenthood package.`

  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, 'run', member, task], {
      cwd: directory,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const onAbort = () => child.kill()
    abort.addEventListener('abort', onAbort, { once: true })

    let stdout = ''
    let stderr = ''
    // cap output so one runaway member run cannot flood the session context
    const MAX = 200_000
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
      if (stdout.length > MAX) stdout = `${stdout.slice(0, MAX)}\n[output truncated]`
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
      if (stderr.length > 16_000) stderr = `${stderr.slice(0, 16_000)}\n[stderr truncated]`
    })
    child.on('close', (code) => {
      abort.removeEventListener('abort', onAbort)
      const body = stdout.trim() || 'no output'
      const err = stderr.trim() ? `\n[stderr]\n${stderr.trim()}` : ''
      const status = code === 0 ? '' : `\n[exit code ${code}]`
      resolve(`${body}${err}${status}`)
    })
    child.on('error', (err) => {
      abort.removeEventListener('abort', onAbort)
      resolve(`failed to spawn agenthood: ${err.message}`)
    })
  })
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
              + 'Members: the-builder, the-reviewer, the-warden, the-tester, the-debugger, the-auditor, '
              + 'the-architect, the-scribe, the-doorman, the-sentinel, the-oracle, the-librarian, the-herald, '
              + 'the-envoy, the-steward, the-mediator, the-strategist, the-operator, the-mailman, the-inspector. '
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