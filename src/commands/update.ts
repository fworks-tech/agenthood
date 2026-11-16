import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { CommandDescriptor } from './types.ts'
import { collectUpdates, type SkillUpdateInfo } from '../skills/updates.ts'
import { diffLines } from '../skills/lineDiff.ts'
import { userError } from '../core/cliError.ts'

const STATUS_LABEL: Record<SkillUpdateInfo['status'], string> = {
  'up-to-date': 'up to date',
  outdated: 'outdated',
  ahead: 'ahead of packaged',
  modified: 'modified locally',
  'not-installed': 'not installed here',
}

export const command: CommandDescriptor = {
  name: 'update',
  description: 'Compare project skill copies with the packaged version, then overwrite or preview the diff',
  handler: (args) => update(args),
}

export async function update(args: string[]): Promise<void> {
  const target = args.find((arg) => !arg.startsWith('--'))
  const dryRun = args.includes('--dry-run')
  const overwrite = args.includes('--overwrite')
  const skip = args.includes('--skip')

  if (args.includes('--merge')) {
    userError('--merge is not available', {
      fix: 'A three-way merge needs the base revision the lockfile does not store. Use --dry-run to see the diff, then --overwrite or hand-merge.',
    })
  }

  const all = collectUpdates(process.cwd()).filter((info) => info.status !== 'not-installed')
  const candidates = target ? all.filter((info) => info.name === target) : all
  if (target && candidates.length === 0) {
    userError(`"${target}" has no project copy to update`, {
      fix: 'Run `agenthood update` to list packaged skills that have a local copy.',
    })
  }

  const actionable = candidates.filter((info) => info.status !== 'up-to-date')
  if (actionable.length === 0) {
    console.log(`\n  ✓ ${candidates.length} skill(s) up to date\n`)
    return
  }

  for (const info of actionable) {
    console.log(`\n  ${info.name} — ${STATUS_LABEL[info.status]} (local ${info.localVersion ?? '?'} → packaged ${info.packagedVersion ?? '?'})`)
    if (dryRun && info.localPath && info.status !== 'not-installed') {
      const local = readFileSync(info.localPath, 'utf8')
      const upstream = readFileSync(info.packagedPath, 'utf8')
      for (const line of diffLines(local, upstream)) {
        if (line.kind === ' ') continue
        console.log(`    ${line.kind} ${line.text}`)
      }
      continue
    }
    if (!overwrite || skip || !info.localPath) {
      console.log('    preview the change with --dry-run, apply it with --overwrite')
      continue
    }
    mkdirSync(dirname(info.localPath), { recursive: true })
    writeFileSync(info.localPath, readFileSync(info.packagedPath, 'utf8'), 'utf8')
    console.log(`    ✓ overwritten from ${info.packagedPath}`)
  }
  console.log('')

  if (!dryRun && !overwrite && !skip) {
    console.log('  Nothing written. Re-run with --dry-run to inspect or --overwrite to apply.\n')
  }
}
