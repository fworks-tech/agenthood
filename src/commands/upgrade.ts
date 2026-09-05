import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { CommandDescriptor } from './types.ts'
import { SkillRegistryClient } from '../skills/registry/SkillRegistryClient.ts'
import { resolveSkillsDir } from '../members.ts'

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
  --help    Show this help
`)
}

export const command: CommandDescriptor = {
  name: 'upgrade',
  description: 'Upgrade installed skills to latest version',
  handler: (args) => upgrade(args),
}

export async function upgrade(args: string[]): Promise<void> {
  const skillName = args.filter((a) => !a.startsWith('--'))[0]
  const help = args.includes('--help')

  if (help) {
    printHelp()
    return
  }

  const cwd = process.cwd()
  const skillsDir = resolveSkillsDir(cwd)
  const lock = loadLockfile(skillsDir)
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
    saveLockfile(skillsDir, lock)
    console.log(`\n  Upgraded ${upgraded} skill(s).\n`)
  }
}
