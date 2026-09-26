import type { CommandDescriptor } from './types.ts'
import { readSkillStats, triggerRate } from '../skills/activation/SkillStats.ts'

function formatPct(rate: number | null): string {
  return rate === null ? '—' : `${(rate * 100).toFixed(0)}%`
}

export const command: CommandDescriptor = {
  name: 'stats',
  description: 'Show per-skill usage analytics: activations, trigger rate, error rate',
  handler: (args) => statsHandler(args),
}

async function statsHandler(args: string[]): Promise<void> {
  const cwd = process.cwd()
  const stats = readSkillStats(cwd)
  const json = args.includes('--json')

  if (json) {
    console.log(JSON.stringify(stats, null, 2))
    return
  }

  const rows = Object.entries(stats).sort((a, b) => b[1].activations - a[1].activations)

  if (rows.length === 0) {
    console.log('\n  No skill usage recorded yet. Activate a skill to collect analytics.\n')
    return
  }

  console.log('\n  Skill Usage\n')
  console.log(`  ${'Skill'.padEnd(28)} ${'Activations'.padEnd(13)} ${'Trigger'.padEnd(9)} ${'Errors'.padEnd(8)} Last Run`)
  console.log(`  ${''.padEnd(28, '-')} ${''.padEnd(13, '-')} ${''.padEnd(9, '-')} ${''.padEnd(8, '-')} ${''.padEnd(24, '-')}`)
  for (const [skill, stat] of rows) {
    const errorRate = stat.activations === 0 ? null : stat.failures / stat.activations
    const lastRun = stat.lastRun ? new Date(stat.lastRun).toLocaleDateString() : '—'
    console.log(
      `  ${skill.padEnd(28)} ${String(stat.activations).padEnd(13)} ${formatPct(triggerRate(stat)).padEnd(9)} ${formatPct(errorRate).padEnd(8)} ${lastRun}`,
    )
  }
  console.log('\n  Analytics are local only. Opt out with `analytics.enabled: false` in .agenthood/config.json.\n')
}
