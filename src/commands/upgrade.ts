import type { CommandDescriptor } from './types.ts'
import { SkillRegistryClient } from '../skills/registry/SkillRegistryClient.ts'
import { resolveSkillsDir } from '../members.ts'
import { loadSkillsLockfile, saveSkillsLockfile } from './skillsLock.ts'

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
