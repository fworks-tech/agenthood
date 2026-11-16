/**
 * The only place a skill script is spawned (ADR-036). Activation is the
 * authorization event, so the skill must be active; the script must resolve
 * inside the skill directory; one-off commands must be version-pinned; output is
 * capped; every run is audited.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync, spawn } from 'node:child_process'
import { basename, join, relative, sep } from 'node:path'
import type { ToolResult } from '../../tools/ITool.ts'
import type { ISkillManifest } from '../discovery/ISkillManifest.ts'
import { resolveInsideProject } from '../../tools/pathGuard.ts'
import { detectScript, type DetectedScript } from './language.ts'
import { isOneOffReference, parseOneOffCommand } from './oneOff.ts'
import { recordResourceAccess } from '../activation/SkillStats.ts'
import { MAX_INLINE_BYTES, capBytes, headAndTail, outputLogPath, pageLines, spillOutput } from './output.ts'
import { detectDocker, sandboxDockerArgs, sandboxRequired } from './sandbox.ts'
import { readCachedOutput, recordCacheResult, resultCacheKey, writeCachedOutput } from './resultCache.ts'

export interface RunScriptRequest {
  skill?: string
  script?: string
  args?: string[]
  page?: number
  page_size?: number
  /** Bypass the output cache for this call (ADR-038). */
  no_cache?: boolean
}

export interface RunScriptDeps {
  projectPath: string
  executionId: string
  manifests: Map<string, ISkillManifest>
  /** Skills activated in this run — the authorization set. */
  activeSkills: ReadonlySet<string>
  sandbox: boolean
  trustedAuthors?: string[]
  timeoutMs?: number
  noCache?: boolean
  /** Output cache TTL in ms; unset or 0 disables caching (ADR-038). */
  cacheTtlMs?: number
}

interface CommandResult {
  code: number | null
  stdout: string
  stderr: string
  timedOut: boolean
}

const DEFAULT_TIMEOUT_MS = 120_000
/** Windows runs .cmd shims through the shell; these characters would let a token escape. */
const SHELL_SAFE = /^[\w@.,:=/+\-~]+$/
/** Shims PATHEXT resolves but spawn cannot start directly on Windows. */
const WINDOWS_SHIMS = new Set(['npx', 'uvx', 'pipx', 'cargo', 'uv'])

function runCommand(command: string, args: string[], cwd: string, timeoutMs: number): Promise<CommandResult> {
  return new Promise((resolve) => {
    // shortcut: Windows .cmd shims need the shell, so one-off tokens are
    // charset-checked first. Upgrade to a shim resolver if more are needed.
    const shell = process.platform === 'win32' && WINDOWS_SHIMS.has(command)
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], shell, windowsHide: true })
    let stdout = ''
    let stderr = ''
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill()
    }, timeoutMs)

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8')
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
    })
    child.on('error', (err) => {
      clearTimeout(timer)
      resolve({ code: null, stdout, stderr: `${stderr}${err.message}`, timedOut: false })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code, stdout, stderr, timedOut })
    })
  })
}

function runtimeVersion(command: string): string {
  try {
    const output = execFileSync(command, ['--version'], { timeout: 5000, encoding: 'utf8' })
    return String(output).split('\n')[0].trim() || command
  } catch {
    return command
  }
}

function audit(projectPath: string, row: Record<string, unknown>): void {
  try {
    mkdirSync(join(projectPath, '.agenthood'), { recursive: true })
    appendFileSync(join(projectPath, '.agenthood', 'skill-exec-audit.ndjson'), `${JSON.stringify(row)}\n`, 'utf8')
  } catch (err) {
    console.warn(`[skills] audit log unavailable: ${err instanceof Error ? err.message : String(err)}`)
  }
}

function fail(error: string): ToolResult {
  return { success: false, output: '', error }
}

function header(fields: Record<string, string | number>): string {
  return `[skill_script ${Object.entries(fields).map(([key, value]) => `${key}="${value}"`).join(' ')}]`
}

/** A paginated read of output spilled by an earlier run in this execution. */
function readPage(deps: RunScriptDeps, script: string, page: number, pageSize?: number): ToolResult {
  const path = outputLogPath(deps.projectPath, deps.executionId, script)
  if (!existsSync(path)) return fail(`No spilled output for "${script}" in this run.`)
  return { success: true, output: pageLines(readFileSync(path, 'utf8'), page, pageSize) }
}

export async function runSkillScript(request: RunScriptRequest, deps: RunScriptDeps): Promise<ToolResult> {
  const script = request.script?.trim()
  if (!script) return fail('`script` is required (a path under the skill directory, or a pinned one-off command).')
  if (request.page !== undefined) return readPage(deps, script, request.page, request.page_size)

  const skillName = request.skill?.trim()
  if (!skillName) return fail('`skill` is required.')
  if (!deps.activeSkills.has(skillName)) {
    return fail(`Skill "${skillName}" is not active in this run. Activate it with activate_skill first.`)
  }
  const manifest = deps.manifests.get(skillName)
  if (!manifest) return fail(`Skill "${skillName}" not found.`)

  const oneOff = isOneOffReference(script) ? parseOneOffCommand(script, deps.noCache) : undefined
  if (oneOff && !oneOff.ok) return fail(oneOff.error)

  let command: string[]
  let detected: DetectedScript | undefined
  let scriptPath = script
  let digest = ''
  if (oneOff?.ok) {
    command = oneOff.command.argv
  } else {
    const guarded = await resolveInsideProject(manifest.directory, script)
    if (!guarded.ok) return fail(guarded.error)
    scriptPath = guarded.path
    if (!existsSync(scriptPath)) return fail(`Script "${script}" not found in skill "${skillName}".`)
    if (statSync(scriptPath).size > 1024 * 1024) return fail(`Script "${script}" is larger than 1 MiB — refusing to run it.`)

    const source = readFileSync(scriptPath, 'utf8')
    digest = createHash('sha256').update(source).digest('hex')
    detected = detectScript(scriptPath, source)
    if (!detected) {
      return fail(`Unsupported script "${script}". Supported: .py, .js, .mjs, .cjs, .ts, .sh, .bash, or a shebang.`)
    }
    // Relative to the skill directory, so host and container agree on the path.
    command = [...detected.command, relative(manifest.directory, scriptPath).split(sep).join('/')]
  }

  if (oneOff?.ok && process.platform === 'win32' && command.some((token) => !SHELL_SAFE.test(token))) {
    return fail('A one-off command contains a character Windows cannot pass safely. Simplify it or run with --sandbox.')
  }

  const decision = sandboxRequired(manifest, {
    sandbox: deps.sandbox,
    trustedAuthors: deps.trustedAuthors ?? [],
  })
  if (decision.required && !detectDocker()) {
    return fail(
      `Skill "${skillName}" cannot run here: ${decision.reason}, and Docker is not available. Install Docker or trust the author.`,
    )
  }

  const argv = [...command, ...(request.args ?? [])]
  const final = decision.required ? ['docker', ...sandboxDockerArgs(manifest.directory, argv)] : argv

  // Output cache (ADR-038): opt-in, bundled scripts only, keyed by content.
  const ttl = deps.cacheTtlMs ?? 0
  const cacheKey = ttl > 0 && !oneOff?.ok ? resultCacheKey(skillName, script, request.args ?? [], digest) : undefined
  if (cacheKey && !request.no_cache) {
    const cached = readCachedOutput(deps.projectPath, cacheKey, ttl)
    if (cached !== undefined) {
      recordCacheResult(deps.projectPath, true)
      const meta = header({ skill: skillName, script: basename(scriptPath), runtime: 'cached', sandbox: 'none', exit: '0', cache: 'hit' })
      return { success: true, output: `${meta}
${cached}` }
    }
    recordCacheResult(deps.projectPath, false)
  }

  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const started = Date.now()
  const result = await runCommand(final[0], final.slice(1), manifest.directory, timeoutMs)
  const duration = Date.now() - started
  const mode = decision.required ? 'docker' : 'host'

  audit(deps.projectPath, {
    at: new Date().toISOString(),
    skill: skillName,
    script,
    argv: final,
    cwd: manifest.directory,
    sandbox: mode,
    exit: result.code,
    durationMs: duration,
    timedOut: result.timedOut,
  })

  const combined = [result.stdout, result.stderr].filter(Boolean).join('\n')
  if (!oneOff?.ok) recordResourceAccess(deps.projectPath, skillName, script)
  const runtime = oneOff?.ok ? `${command[0]} (pinned)` : `${detected?.command[0]} (${runtimeVersion(detected?.command[0] ?? command[0])})`
  const meta = header({
    skill: skillName,
    script: basename(scriptPath),
    runtime,
    sandbox: mode,
    exit: result.timedOut ? 'timeout' : String(result.code ?? 'signal'),
    duration: `${duration}ms`,
  })

  if (result.timedOut) {
    return { success: false, output: meta, error: `Script "${script}" timed out after ${timeoutMs}ms and was stopped.` }
  }

  if (cacheKey && result.code === 0) writeCachedOutput(deps.projectPath, cacheKey, combined)

  if (Buffer.byteLength(combined, 'utf8') > MAX_INLINE_BYTES) {
    const path = spillOutput(deps.projectPath, deps.executionId, script, combined)
    const preview = capBytes(headAndTail(combined), MAX_INLINE_BYTES).text
    return {
      success: result.code === 0,
      output: `${meta}\nFull output (${Buffer.byteLength(combined, 'utf8')} bytes): ${path}\nRead it with { "page": 1 }.\n${preview}`,
      ...(result.code === 0 ? {} : { error: `Script exited with status ${result.code}.` }),
    }
  }

  return {
    success: result.code === 0,
    output: `${meta}\n${combined}`,
    ...(result.code === 0 ? {} : { error: `Script exited with status ${result.code}.` }),
  }
}
