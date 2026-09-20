import type { CommandDescriptor } from './types.ts'
import { SkillRegistryClient } from '../skills/registry/SkillRegistryClient.ts'
import { resolveSkillsDir } from '../members.ts'
import { loadSkillsLockfile, saveSkillsLockfile } from './skillsLock.ts'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { fetchRemoteText } from '../skills/discovery/RemoteSkillSource.ts'

const NPM_LATEST_URL = 'https://registry.npmjs.org/agenthood/latest'

/** Package root whether running from src/ (dev) or dist/ (installed). */
function packageRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..', '..')
}

async function selfUpgrade(): Promise<void> {
  const cwd = process.cwd()
  const current = (JSON.parse(readFileSync(join(packageRoot(), 'package.json'), 'utf-8')) as { version?: string }).version

  const raw = await fetchRemoteText(NPM_LATEST_URL)
  if (!raw) {
    console.error('  ✗ Could not reach the npm registry — check connectivity')
    process.exit(1)
    return
  }
  const latest = (JSON.parse(raw) as { version?: string }).version
  if (!latest) {
    console.error('  ✗ npm registry returned no version for agenthood')
    process.exit(1)
    return
  }

  console.log(`\n  Installed: v${current}   Latest: v${latest}`)
  if (current === latest) {
    console.log('  Already at the latest version.\n')
    return
  }

  const configDir = join(cwd, '.agenthood')
  const configPath = join(configDir, 'config.json')
  if (existsSync(configPath)) {
    mkdirSync(join(configDir, 'backup'), { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    writeFileSync(join(configDir, 'backup', `config-${stamp}.json`), readFileSync(configPath, 'utf-8'), 'utf-8')
    console.log(`  ✓ Config backed up to .agenthood/backup/config-${stamp}.json`)

    const config = JSON.parse(readFileSync(configPath, 'utf-8')) as { version?: string }
    if (config.version !== '1') {
      console.warn(`  ⚠ Config version "${config.version ?? 'missing'}" is not recognized — review .agenthood/config.json after the upgrade`)
    }
  }

  console.log('  Running npm install...')
  try {
    // pin the fetched version: installing '@latest' could resolve a newer
    // release than the one just validated against the local config
    execFileSync('npm', ['install', '--no-fund', '--no-audit', `agenthood@${latest}`], { cwd, stdio: 'inherit' })
    console.log(`\n  ✓ Upgraded to v${latest}.\n`)
  } catch (err) {
    console.error(`  ✗ npm install failed — run \`npm install agenthood@latest\` manually (${(err as Error)?.message ?? err})`)
    process.exit(1)
  }
}

interface LockEntry {
  source: string
  version?: string
  installedAt: string
}

interface Lockfile {
  version: number
  skills: Record<string, LockEntry>
}

const LOCKFILE = 'skills-lock.json'

function loadLockfile(skillsDir: string): Lockfile {
  const lockPath = join(skillsDir, LOCKFILE)
  if (!existsSync(lockPath)) return { version: 1, skills: {} }
  try {
    return JSON.parse(readFileSync(lockPath, 'utf-8')) as Lockfile
  } catch {
    return { version: 1, skills: {} }
  }
}

function saveLockfile(skillsDir: string, lock: Lockfile): void {
  const lockPath = join(skillsDir, LOCKFILE)
  writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n', 'utf-8')
}

function printHelp(): void {
  console.log(`Usage:
  npx agenthood upgrade [skill-name]

Upgrade installed skills to the latest version from the registry.

Options:
  --agenthood   Upgrade the agenthood package itself (backs up .agenthood/config.json first)
  --help        Show this help
`)
}

export const command: CommandDescriptor = {
  name: 'upgrade',
  description: 'Upgrade installed skills to latest version',
  handler: (args) => upgrade(args),
}

export async function upgrade(args: string[]): Promise<void> {
  if (args.includes('--agenthood')) {
    await selfUpgrade()
    return
  }

  const skillName = args.filter((a) => !a.startsWith('--'))[0]
  const help = args.includes('--help')

  if (help) {
    printHelp()
    return
  }

  const cwd = process.cwd()
  const skillsDir = resolveSkillsDir(cwd)
  const lock = loadSkillsLockfile(skillsDir)
  const client = new SkillRegistryClient()

  const skillsToUpgrade = skillName
    ? [skillName]
    : Object.keys(lock.skills)

  if (skillsToUpgrade.length === 0) {
    console.log('\n  No installed skills found. Use `agenthood install` first.\n')
    return
  }

  let upgraded = 0
  for (const name of skillsToUpgrade) {
    const entry = lock.skills[name]
    if (!entry && skillName) {
      console.error(`\n  Skill "${name}" is not installed.`)
      continue
    }

    try {
      const remote = await client.get(name)
      if (!remote) {
        console.log(`  ${name}: not found in registry`)
        continue
      }

      if (entry?.version && entry.version === remote.version) {
        console.log(`  ${name}: already at v${remote.version}`)
        continue
      }

      console.log(`  ${name}: upgrading from ${entry?.version ?? 'unknown'} to v${remote.version}`)
      lock.skills[name] = {
        source: entry?.source ?? `registry:${name}`,
        version: remote.version,
        installedAt: new Date().toISOString(),
      }
      upgraded++
    } catch (err) {
      console.error(`  ${name}: upgrade failed — ${(err as Error)?.message ?? err}`)
    }
  }

  if (upgraded > 0) {
    saveSkillsLockfile(skillsDir, lock)
    console.log(`\n  Upgraded ${upgraded} skill(s).\n`)
  }
}
