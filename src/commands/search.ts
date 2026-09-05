import type { CommandDescriptor } from './types.ts'
import { SkillRegistryClient } from '../skills/registry/SkillRegistryClient.ts'

function printHelp(): void {
  console.log(`Usage:
  npx agenthood search <query>

Search for skills in the agenthood registry.

Options:
  --json    Machine-readable JSON output
  --help    Show this help
`)
}

export const command: CommandDescriptor = {
  name: 'search',
  description: 'Search for skills in the registry',
  handler: (args) => search(args),
}

export async function search(args: string[]): Promise<void> {
  const query = args.filter((a) => !a.startsWith('--'))[0]
  const json = args.includes('--json')
  const help = args.includes('--help')

  if (!query || help) {
    printHelp()
    return
  }

  const client = new SkillRegistryClient()

  try {
    const result = await client.search(query)

    if (json) {
      console.log(JSON.stringify(result, null, 2))
      return
    }

    if (result.skills.length === 0) {
      console.log(`\n  No skills found for "${query}".\n`)
      return
    }

    console.log(`\n  Found ${result.total} skill(s) for "${query}":\n`)
    for (const skill of result.skills) {
      const tier = skill.tier ? ` [${skill.tier}]` : ''
      const rating = skill.rating ? ` ★${skill.rating.toFixed(1)}` : ''
      const downloads = skill.downloads ? ` (${skill.downloads} downloads)` : ''
      console.log(`  ${skill.name}${tier}${rating}${downloads}`)
      console.log(`    ${skill.description}`)
      console.log(`    v${skill.version} • ${skill.author ?? 'unknown'}`)
      console.log()
    }
  } catch (err) {
    console.error(`\n  Search failed: ${(err as Error)?.message ?? err}\n`)
    process.exit(1)
  }
}
