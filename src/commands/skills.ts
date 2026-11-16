import type { CommandDescriptor } from './types.ts'
import { loadConfig } from './config.ts'
import type { LLMConfig } from '../llm/types.ts'
import { SkillDiscovery } from '../skills/discovery/SkillDiscovery.ts'
import { filterReason, orderSkills } from '../skills/catalog/format.ts'

export const command: CommandDescriptor = {
  name: 'skills',
  description: 'List discovered skills, their priority, and what is filtered out',
  handler: (args) => skills(args),
}

export async function skills(args: string[]): Promise<void> {
  if (args.includes('--help')) {
    console.log(`Usage:
  agenthood skills [--show-disabled] [--json]

Lists discovered skills in catalog order. --show-disabled names the skills the
catalog omits and why: config disable, hidden: true, or disable-model-invocation.
`)
    return
  }

  const showDisabled = args.includes('--show-disabled')
  const json = args.includes('--json')
  const config = await loadConfig().catch((): LLMConfig => ({}))
  const disabled = new Set(config.skills?.disabled ?? [])

  const discovery = new SkillDiscovery()
  const found = discovery.discover(process.cwd())
  const listed = orderSkills(found.filter((m) => filterReason(m, disabled) === undefined))
  const filtered = found
    .map((m) => ({ manifest: m, reason: filterReason(m, disabled) }))
    .filter((entry): entry is { manifest: typeof entry.manifest; reason: string } => entry.reason !== undefined)

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
  console.log('')
}
