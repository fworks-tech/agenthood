import type { CommandDescriptor } from './types.ts'
import { loadConfig } from './config.ts'
import type { LLMConfig } from '../llm/types.ts'
import { SkillDiscovery } from '../skills/discovery/SkillDiscovery.ts'
import { filterReason, orderSkills } from '../skills/catalog/format.ts'
import { gateSkills } from '../skills/discovery/gating.ts'

export const command: CommandDescriptor = {
  name: 'skills',
  description: 'List discovered skills, their priority, and what is filtered out',
  handler: (args) => skills(args),
}

export async function skills(args: string[]): Promise<void> {
  if (args.includes('--help')) {
    console.log(`Usage:
  agenthood skills [--show-disabled] [--json] [--stats]

Lists discovered skills in catalog order. --show-disabled names the skills the
catalog omits and why: config disable, hidden: true, disable-model-invocation, or
a requirement this model cannot meet (model-targets, requires, dependencies).
--stats prints scan counters: directories visited, skills found, cache hits,
duration, and whether the scan stopped at the directory cap.
`)
    return
  }

  const showDisabled = args.includes('--show-disabled')
  const json = args.includes('--json')
  const showStats = args.includes('--stats')
  const config = await loadConfig().catch((): LLMConfig => ({}))
  const disabled = new Set(config.skills?.disabled ?? [])

  const discovery = new SkillDiscovery()
  const found = discovery.discover(process.cwd())
  const stats = discovery.lastStats()
  const gate = gateSkills(found, { provider: config.provider, model: config.model })
  const hiddenReason = (m: (typeof found)[number]): string | undefined =>
    filterReason(m, disabled) ?? gate.blocked.get(m.name)
  const listed = orderSkills(found.filter((m) => hiddenReason(m) === undefined))
  const filtered = found
    .map((m) => ({ manifest: m, reason: hiddenReason(m) }))
    .filter((entry): entry is { manifest: (typeof found)[number]; reason: string } => entry.reason !== undefined)

  if (json) {
    console.log(
      JSON.stringify(
        {
          skills: listed.map((m) => ({
            name: m.name,
            description: m.description,
            priority: m.priority ?? 0,
            version: m.version,
            directory: m.directory,
          })),
          ...(showDisabled
            ? { filtered: filtered.map((f) => ({ name: f.manifest.name, reason: f.reason })) }
            : {}),
          ...(showStats ? { stats } : {}),
        },
        null,
        2,
      ),
    )
    return
  }

  if (listed.length === 0) {
    console.log('\n  No skills discovered in this project.\n')
  } else {
    console.log(`\n  ${listed.length} skill(s):\n`)
    const width = Math.max(...listed.map((m) => m.name.length))
    for (const m of listed) {
      const priority = m.priority ? `  p${m.priority}` : ''
      const version = m.version ? ` v${m.version}` : ''
      console.log(`    ${m.name.padEnd(width)}${version}${priority}`)
      console.log(`      ${m.description}`)
      console.log(`      ${m.directory}`)
    }
  }

  if (showDisabled && filtered.length > 0) {
    console.log(`\n  Filtered from the catalog (${filtered.length}):\n`)
    const width = Math.max(...filtered.map((f) => f.manifest.name.length))
    for (const entry of filtered) {
      console.log(`    ${entry.manifest.name.padEnd(width)}  ${entry.reason}`)
    }
  }
  if (showStats) {
    console.log(`\n  Scan: ${stats.directories} directorie(s), ${stats.skills} skill(s), ${stats.cacheHits} cache hit(s), ${stats.durationMs} ms${stats.truncated ? ' — stopped at the directory cap, results may be incomplete' : ''}`)
  }
  console.log('')
}
