/**
 * agenthood ritual
 *
 * Rituals are declared in docs/rituals/*.md — frontmatter binds a cron
 * schedule to a member. Scheduled runs live in .github/workflows/rituals.yml
 * (parity enforced by tests/unit/scripts/rituals-workflow.test.ts); this
 * command lists them and runs one manually.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { CommandDescriptor } from './types.ts'
import { run as runCli } from './run.ts'

interface RitualManifest {
  file: string
  name: string
  schedule: string
  priority: string
  member: string
  description: string
}

export function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return {}
  const fields: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const m = line.match(/^([\w-]+):\s*(.+)$/)
    if (!m) continue
    fields[m[1]] = m[2].replace(/^["'](.*)["']$/, '$1')
  }
  return fields
}

export function loadRituals(dir: string): RitualManifest[] {
  if (!existsSync(dir)) return []
  const manifests: RitualManifest[] = []
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.md')).sort()) {
    const fields = parseFrontmatter(readFileSync(join(dir, file), 'utf-8'))
    if (!fields.name || !fields.member || !fields.description) continue
    manifests.push({
      file,
      name: fields.name,
      schedule: fields.schedule ?? '',
      priority: fields.priority ?? '',
      member: fields.member,
      description: fields.description,
    })
  }
  return manifests
}

function ritualsDir(): string {
  return join(process.cwd(), 'docs', 'rituals')
}

function printUsage(): void {
  console.error('Usage: agenthood ritual list')
  console.error('       agenthood ritual run <name>')
}

function listRituals(): void {
  const manifests = loadRituals(ritualsDir())
  if (manifests.length === 0) {
    console.log('\nNo rituals found — docs/rituals/ is empty or missing.')
    console.log('Create docs/rituals/<name>.md with frontmatter:')
    console.log('  ---')
    console.log('  name: <ritual>')
    console.log('  schedule: "0 8 * * 1-5"')
    console.log('  priority: SCHEDULED')
    console.log('  member: <member>')
    console.log('  description: <task summary>')
    console.log('  ---')
    return
  }
  console.log('\n⏰ Rituals — docs/rituals/\n')
  const namePad = Math.max(...manifests.map((m) => m.name.length))
  for (const m of manifests) {
    console.log(`  ${m.name.padEnd(namePad)}  ${m.schedule.padEnd(12)}  ${m.priority.padEnd(11)}  ${m.member}`)
    console.log(`    ${m.description}\n`)
  }
  console.log('  Run one: npx agenthood ritual run <name>\n')
}

export async function ritual(args: string[]): Promise<void> {
  const [mode, ...rest] = args

  if (mode === 'run') {
    const name = rest[0]
    if (!name) {
      console.error('Missing ritual name.')
      printUsage()
      process.exit(1)
    }
    const manifests = loadRituals(ritualsDir())
    const manifest = manifests.find((m) => m.name === name)
    if (!manifest) {
      console.error(`Unknown ritual: "${name}"`)
      if (manifests.length > 0) console.error(`Available: ${manifests.map((m) => m.name).join(', ')}`)
      process.exit(1)
    }
    const task = `${manifest.description}\n\nFollow the steps and report format defined in docs/rituals/${manifest.file}.`
    await runCli([manifest.member, task])
    return
  }

  if (!mode || mode === 'list') {
    listRituals()
    return
  }

  console.error(`Unknown ritual subcommand: "${mode}"`)
  printUsage()
  process.exit(1)
}

export const command: CommandDescriptor = {
  name: 'ritual',
  description: 'List declared rituals or run one manually (docs/rituals/)',
  handler: (args) => ritual(args),
}
