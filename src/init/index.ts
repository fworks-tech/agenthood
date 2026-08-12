import { installSkills, scaffoldConfig, planPaths } from './setup.js'
import { promptRuntime, promptMembers } from './ui.js'

export async function init(args: string[] = []): Promise<void> {
  const dryRun = args.includes('--dry-run')
  const cwd = process.cwd()

  console.log('\n🏛️  Welcome to the Agenthood.\n')

  const runtime = await promptRuntime()
  const members = await promptMembers()

  if (dryRun) {
    console.log('\n  Dry run — nothing will be written. Would create:')
    for (const path of planPaths(cwd, runtime, members)) {
      console.log(`    ${path}`)
    }
    console.log('\n  Run without --dry-run to write these files.\n')
    return
  }

  const steps: Array<[string, () => Promise<void>]> = [
    ['Member skills', () => installSkills(cwd, runtime, members)],
    ['Agenthood config', () => scaffoldConfig(cwd, runtime, members)],
  ]

  for (const [label, step] of steps) {
    process.stdout.write(`  Installing ${label}...`)
    try {
      await step()
      console.log(' ✅')
    } catch (err) {
      console.log(' ❌')
      console.error(`    Failed: ${err}`)
    }
  }

  console.log('\n🏛️  The Society is ready.\n')
  console.log('  Run `npx agenthood check` to verify the initiation.')
  console.log('  Run `npx agenthood oath` to read the oath.\n')
}
