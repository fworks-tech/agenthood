import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { installSkills, scaffoldConfig, planPaths } from './setup.ts'
import { promptRuntime, promptMembers, confirmOverwrite, RUNTIMES } from './ui.ts'
import { ALL_MEMBERS } from '../members.ts'
import type { Runtime } from '../members.ts'

type OverwriteDecision = { action: 'overwrite' } | { action: 'proceed' } | { action: 'abort' }

function parseCiSelections(args: string[]): { runtime: Runtime; members: string[] } {
  let runtime: Runtime = 'claude-code'
  let members = ALL_MEMBERS.map((m) => m.name)

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--runtime' && i + 1 < args.length) {
      const value = args[++i] as Runtime
      if (!RUNTIMES.includes(value)) {
        console.error(`Invalid --runtime "${value}" — expected one of: ${RUNTIMES.join(', ')}`)
        process.exit(1)
      }
      runtime = value
    } else if (args[i] === '--members' && i + 1 < args.length) {
      const value = args[++i]
      if (value !== 'all') {
        const names = new Set(ALL_MEMBERS.map((m) => m.name))
        members = value.split(',').map((s) => s.trim())
        const unknown = members.filter((m) => !names.has(m))
        if (unknown.length > 0) {
          console.error(`Unknown member(s) in --members: ${unknown.join(', ')}`)
          process.exit(1)
        }
        if (members.length === 0) members = ALL_MEMBERS.map((m) => m.name)
      }
    }
  }

  return { runtime, members }
}

async function resolveOverwrite(cwd: string, dryRun: boolean, force: boolean, ci: boolean): Promise<OverwriteDecision> {
  if (dryRun || !existsSync(join(cwd, '.agenthood', 'config.json'))) return { action: 'proceed' }
  if (force) {
    console.log('  --force: overwriting the existing setup.\n')
    return { action: 'overwrite' }
  }
  if (ci) {
    console.log('  --ci: an existing setup was found — keeping it (pass --force to overwrite).\n')
    return { action: 'abort' }
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
  const ci = args.includes('--ci')
  const cwd = process.cwd()

  console.log('\n🏛️  Welcome to the Agenthood.\n')

  const decision = await resolveOverwrite(cwd, dryRun, force, ci)
  if (decision.action === 'abort') return
  const overwrite = decision.action === 'overwrite'

  let runtime: Runtime
  let members: string[]
  if (ci) {
    const selections = parseCiSelections(args)
    runtime = selections.runtime
    members = selections.members
    console.log(`  CI mode: runtime=${runtime}, members=${members.join(', ')}\n`)
  } else {
    runtime = await promptRuntime()
    members = await promptMembers()
  }

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
