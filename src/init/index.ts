import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { installSkills, scaffoldConfig, planPaths } from './setup.ts'
import { promptRuntime, promptMembers, confirmOverwrite } from './ui.ts'

export async function init(args: string[] = []): Promise<void> {
  const dryRun = args.includes('--dry-run')
  const force = args.includes('--force')
  const cwd = process.cwd()

  console.log('\n🏛️  Welcome to the Agenthood.\n')

  let overwrite = false
  if (!dryRun && existsSync(join(cwd, '.agenthood', 'config.json'))) {
    if (force) {
      console.log('  --force: overwriting the existing setup.\n')
      overwrite = true
    } else {
      console.log('  An existing Agenthood setup was found in this project.\n')
      if (!(await confirmOverwrite())) {
        console.log('\n  Keeping the existing setup — nothing was changed.\n')
        return
      }
      overwrite = true
    }
  }

  const runtime = await promptRuntime()
  const members = await promptMembers()

  if (dryRun) {
    console.log('\n  Dry run — nothing will be written. Would create:')
    for (const path of planPaths(cwd, runtime, members)) {
      const marker = existsSync(path) ? ' (exists)' : ''
      console.log(`    ${path}${marker}`)
    }
    console.log('\n  Run without --dry-run to write these files.\n')
    return
  }

  const steps: Array<[string, () => Promise<void>]> = [
    ['Member skills', () => installSkills(cwd, runtime, members, overwrite)],
    ['Agenthood config', () => scaffoldConfig(cwd, runtime, members, overwrite)],
  ]

  let failures = 0
  for (const [label, step] of steps) {
    process.stdout.write(`  Installing ${label}...`)
    try {
      await step()
      console.log(' ✅')
    } catch (err) {
      failures++
      console.log(' ❌')
      console.error(`    Failed: ${err}`)
    }
  }

  if (failures > 0) {
    console.error('\n🏛️  Initiation incomplete — some steps failed.')
    process.exit(1)
  }

  console.log('\n🏛️  The Society is ready.\n')
  console.log('  Run `npx agenthood check` to verify the initiation.')
  console.log('  Run `npx agenthood oath` to read the oath.\n')
}
