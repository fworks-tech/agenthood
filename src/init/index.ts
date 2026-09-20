import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { installSkills, scaffoldConfig, planPaths } from './setup.ts'
import { promptRuntime, promptMembers, confirmOverwrite } from './ui.ts'
import type { Runtime } from '../members.ts'

type OverwriteDecision = { action: 'overwrite' } | { action: 'proceed' } | { action: 'abort' }

async function resolveOverwrite(cwd: string, dryRun: boolean, force: boolean): Promise<OverwriteDecision> {
  if (dryRun || !existsSync(join(cwd, '.agenthood', 'config.json'))) return { action: 'proceed' }
  if (force) {
    console.log('  --force: overwriting the existing setup.\n')
    return { action: 'overwrite' }
  }
  console.log('  An existing Agenthood setup was found in this project.\n')
  if (!(await confirmOverwrite())) {
    console.log('\n  Keeping the existing setup — nothing was changed.\n')
    return { action: 'abort' }
  }
  return { action: 'overwrite' }
}

function displayDryRun(cwd: string, runtime: Runtime, members: string[]): void {
  console.log('\n  Dry run — nothing will be written. Would create:')
  for (const path of planPaths(cwd, runtime, members)) {
    const marker = existsSync(path) ? ' (exists)' : ''
    console.log(`    ${path}${marker}`)
  }
  console.log('\n  Run without --dry-run to write these files.\n')
}

async function runSteps(steps: Array<[string, () => Promise<void>]>): Promise<void> {
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
    throw new Error('Initiation incomplete — some steps failed.')
  }
}

export async function init(args: string[] = []): Promise<void> {
  const dryRun = args.includes('--dry-run')
  const force = args.includes('--force')
  const cwd = process.cwd()

  console.log('\n🏛️  Welcome to the Agenthood.\n')

  const decision = await resolveOverwrite(cwd, dryRun, force)
  if (decision.action === 'abort') return
  const overwrite = decision.action === 'overwrite'

  const runtime = await promptRuntime()
  const members = await promptMembers()

  if (dryRun) {
    displayDryRun(cwd, runtime, members)
    return
  }

  try {
    await runSteps([
      ['Member skills', () => installSkills(cwd, runtime, members, overwrite)],
      ['Agenthood config', () => scaffoldConfig(cwd, runtime, members, overwrite)],
    ])
  } catch (err) {
    console.error('\n🏛️  Initiation incomplete — some steps failed.')
    console.error(err)
    process.exit(1)
  }

  console.log('\n🏛️  The Society is ready.\n')
  console.log('  Run `npx agenthood check` to verify the initiation.')
  console.log('  Run `npx agenthood oath` to read the oath.\n')
}
