import type { CommandDescriptor } from './types.ts'
import { join } from 'node:path'
import { clearSkillCaches, readMetadataStats } from '../skills/discovery/manifestCache.ts'
import { readCacheStats } from '../skills/execution/resultCache.ts'

export const command: CommandDescriptor = {
  name: 'cache',
  description: 'Inspect or clear the skill discovery and script output caches',
  handler: (args) => cache(args),
}

export async function cache(args: string[]): Promise<void> {
  const sub = args.find((arg) => !arg.startsWith('-'))
  const projectPath = process.cwd()

  if (args.includes('--help') || (sub !== 'clear' && sub !== 'stats')) {
    console.log(`Usage:
  agenthood cache stats
  agenthood cache clear

stats reports the metadata cache (parsed SKILL.md entries) and the script output
cache (entries and hit rate). clear removes both, plus spilled script output.

A cache hit is only served while the file's mtime and size are unchanged, so
clear is for an intentional rewrite that restores the original mtime.
`)
    return
  }

  if (sub === 'clear') {
    clearSkillCaches(projectPath)
    console.log('\n  Skill caches cleared.\n')
    return
  }

  const metadata = readMetadataStats(projectPath)
  const outputs = readCacheStats(projectPath)
  const rate = outputs.hitRate === null ? 'n/a' : `${Math.round(outputs.hitRate * 100)}%`
  console.log('\n  Metadata cache:')
  console.log(`    entries ${metadata.entries}  hits ${metadata.hits}  misses ${metadata.misses}`)
  console.log(`    ${join('.agenthood', 'skill-cache', 'metadata.json')}`)
  console.log('\n  Script output cache:')
  console.log(`    entries ${outputs.entries}  hits ${outputs.hits}  misses ${outputs.misses}  hit rate ${rate}`)
  console.log('')
}
