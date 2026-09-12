import { existsSync, readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'

import { MEMBER_NAMES, resolveSocietyMembersDir } from '../members.ts'
import { PROVIDER_KEYS } from '../llm/validateApiKeys.ts'
import { loadLockfile } from '../utils/lockfile.ts'
import { checkSkillIntegrity } from '../utils/skillIntegrity.ts'
import { loadConfig } from './config.ts'
import type { LLMConfig } from '../llm/types.ts'
import type { CommandDescriptor } from './types.ts'

type Status = 'pass' | 'fail' | 'warn'
interface Check {
  name: string
  status: Status
  detail: string
}

function printHelp(): void {
  console.log(`Usage:
  npx agenthood doctor [options]

Run all diagnostic checks in one pass: Node version, agenthood version,
config validity, API keys, provider readiness, skill files, lockfile
integrity, and git hooks.

Options:
  --json    Machine-readable JSON output
  --help    Show this help

Exit codes:
  0  healthy (all checks pass, or only warnings)
  1  one or more checks failed
`)
}

function pkgField(key: string): string | undefined {
  try {
    const pkg = JSON.parse(
      readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
    ) as Record<string, unknown>
    return pkg[key] as string | undefined
  } catch {
    return undefined
  }
}

// Compare ">=22.14.0" (or bare "22.14.0") against the running Node version.
function nodeVersionCheck(): Check {
  const required = (() => {
    try {
      const engines = JSON.parse(
        readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
      ) as { engines?: { node?: string } }
      return engines.engines?.node ?? ''
    } catch {
      return ''
    }
  })()
  const min = /(\d+)\.(\d+)\.(\d+)/.exec(required)
  const current = process.versions.node
  if (!min) return { name: 'Node version', status: 'warn', detail: `v${current} (no engine constraint)` }
  const cur = current.split('.').map(Number)
  const need = [Number(min[1]), Number(min[2]), Number(min[3])]
  const ok = cur[0] > need[0] || (cur[0] === need[0] && (cur[1] > need[1] || (cur[1] === need[1] && cur[2] >= need[2])))
  return {
    name: 'Node version',
    status: ok ? 'pass' : 'fail',
    detail: `v${current}${ok ? '' : ` (requires ${required})`}`,
  }
}

function versionCheck(): Check {
  const version = pkgField('version')
  return version
    ? { name: 'agenthood version', status: 'pass', detail: `v${version}` }
    : { name: 'agenthood version', status: 'fail', detail: 'package.json unreadable' }
}

async function configCheck(cwd: string): Promise<{ check: Check; config: LLMConfig }> {
  const configPath = join(cwd, '.agenthood', 'config.json')
  if (!existsSync(configPath)) {
    return { check: { name: 'Config file', status: 'fail', detail: `${configPath} missing — run \`agenthood init\`` }, config: {} }
  }
  try {
    const config = await loadConfig()
    return { check: { name: 'Config file', status: 'pass', detail: 'valid JSON' }, config }
  } catch (err) {
    return { check: { name: 'Config file', status: 'fail', detail: (err as Error).message }, config: {} }
  }
}

function providerKeyPresent(config: LLMConfig, name: string): boolean {
  const info = PROVIDER_KEYS[name]
  if (!info) return true // ollama and other keyless providers need no env var
  const entry = config.providers?.find((p) => p.name === name)
  return Boolean(entry?.apiKey ?? config.apiKey ?? process.env[info.envVar])
}

function configuredProviders(config: LLMConfig): string[] {
  const names = new Set<string>()
  if (config.provider) names.add(config.provider)
  for (const p of config.providers ?? []) names.add(p.name)
  return names.size > 0 ? [...names] : ['groq'] // runtime default chain head
}

function apiKeysCheck(config: LLMConfig): Check {
  const missing = configuredProviders(config).filter((n) => !providerKeyPresent(config, n))
  if (missing.length === 0) {
    return { name: 'API keys', status: 'pass', detail: 'all configured providers have keys' }
  }
  const vars = missing.map((n) => PROVIDER_KEYS[n]?.envVar ?? n)
  return { name: 'API keys', status: 'fail', detail: `missing: ${vars.join(', ')}` }
}

// Local readiness only — no live network probe, which would be slow and break
// offline/Ollama setups. ponytail: add a real connectivity ping if needed.
function providerReadinessCheck(config: LLMConfig): Check {
  const providers = configuredProviders(config)
  const ready = providers.filter((n) => providerKeyPresent(config, n))
  if (ready.length === 0) {
    return { name: 'Provider readiness', status: 'warn', detail: `no providers ready among ${providers.join(', ')}` }
  }
  return { name: 'Provider readiness', status: 'pass', detail: `${ready.length}/${providers.length} ready (${ready.join(', ')})` }
}

function skillFilesCheck(): Check {
  const base = resolveSocietyMembersDir()
  const missing = MEMBER_NAMES.filter((m) => !existsSync(join(base, m, 'SKILL.md')))
  if (missing.length === 0) {
    return { name: 'Skill files', status: 'pass', detail: `${MEMBER_NAMES.length}/${MEMBER_NAMES.length} installed` }
  }
  return { name: 'Skill files', status: 'fail', detail: `missing ${missing.length}: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}` }
}

function lockfileCheck(cwd: string): Check {
  const lock = loadLockfile(cwd)
  if (!lock) {
    return { name: 'Lockfile integrity', status: 'warn', detail: 'agenthood.lock absent — run `agenthood verify --update-lock`' }
  }
  const base = resolveSocietyMembersDir()
  const drifted = MEMBER_NAMES.filter((m) => {
    const status = checkSkillIntegrity(m, join(base, m, 'SKILL.md'), { lockfilePath: cwd })
    return status === 'drift' || status === 'corrupt'
  })
  const locked = Object.keys(lock.members || {}).length
  if (drifted.length > 0) {
    return { name: 'Lockfile integrity', status: 'fail', detail: `${drifted.length} drifted: ${drifted.slice(0, 5).join(', ')}` }
  }
  return { name: 'Lockfile integrity', status: 'pass', detail: `${locked} members locked, no drift` }
}

function gitHooksCheck(cwd: string): Check {
  if (!existsSync(join(cwd, '.git'))) {
    return { name: 'Git hooks', status: 'warn', detail: 'not a git repository' }
  }
  let hooksPath: string
  try {
    hooksPath = execSync('git config core.hooksPath', { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    hooksPath = ''
  }
  const dir = hooksPath || '.git/hooks'
  const active = existsSync(join(cwd, dir, 'pre-commit'))
  if (hooksPath === '.githooks' && active) {
    return { name: 'Git hooks', status: 'pass', detail: 'core.hooksPath → .githooks (pre-commit active)' }
  }
  if (active) {
    return { name: 'Git hooks', status: 'warn', detail: `pre-commit present but core.hooksPath is "${hooksPath || 'default'}" — run \`agenthood setup\`` }
  }
  return { name: 'Git hooks', status: 'fail', detail: 'no pre-commit hook — run `agenthood setup`' }
}

function render(checks: Check[]): void {
  const icon: Record<Status, string> = { pass: '✓', fail: '✗', warn: '⚠' }
  const width = Math.max(...checks.map((c) => c.name.length))
  console.log('\n  Agenthood Doctor\n')
  for (const c of checks) {
    console.log(`  ${icon[c.status]} ${c.name.padEnd(width)}  ${c.detail}`)
  }
  const failed = checks.filter((c) => c.status === 'fail').length
  const warned = checks.filter((c) => c.status === 'warn').length
  const passed = checks.length - failed - warned
  console.log(`\n  ${passed} passed · ${warned} warnings · ${failed} failed\n`)
  console.log(failed === 0 ? '  You are clear to run.\n' : '  Fix the failures above, then run `agenthood doctor` again.\n')
}

export const command: CommandDescriptor = {
  name: 'doctor',
  description: 'Comprehensive diagnostics: runtime, config, providers, skills, lockfile, hooks',
  handler: (args) => doctor(args),
}

export async function doctor(args: string[] = []): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    printHelp()
    return
  }
  const json = args.includes('--json')
  const cwd = process.cwd()

  const { check: config, config: loaded } = await configCheck(cwd)
  const checks: Check[] = [
    nodeVersionCheck(),
    versionCheck(),
    config,
    apiKeysCheck(loaded),
    providerReadinessCheck(loaded),
    skillFilesCheck(),
    lockfileCheck(cwd),
    gitHooksCheck(cwd),
  ]

  const failed = checks.some((c) => c.status === 'fail')

  if (json) {
    console.log(JSON.stringify({ checks, healthy: !failed }, null, 2))
  } else {
    render(checks)
  }

  process.exitCode = failed ? 1 : 0
}
