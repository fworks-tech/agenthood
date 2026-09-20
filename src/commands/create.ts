/**
 * agenthood create <name> [description]
 *
 * Scaffolds a new skill directory with a spec-shaped SKILL.md — the starting
 * point the publish/registry flow expects. Member names are reserved.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { CommandDescriptor } from './types.ts'
import { resolveSkillsDir, MEMBER_NAMES } from '../members.ts'
import { SPEC_NAME_RE } from '../skills/discovery/SkillParser.ts'

export const command: CommandDescriptor = {
  name: 'create',
  description: 'Scaffold a new skill from a template',
  handler: (args) => create(args),
}

function titleize(name: string): string {
  return name.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function template(name: string, description: string): string {
  return [
    '---',
    `name: ${name}`,
    `description: ${description}`,
    'license: MIT',
    '---',
    '',
    `# ${titleize(name)}`,
    '',
    '## Overview',
    '',
    description,
    '',
    '## When to Use',
    '',
    '- Use when ...',
    '',
  ].join('\n')
}

export async function create(args: string[]): Promise<void> {
  const dryRun = args.includes('--dry-run')
  const positional = args.filter((a) => !a.startsWith('--'))
  const name = positional[0]
  const description = positional.slice(1).join(' ')

  if (!name) {
    console.error('\nUsage: agenthood create <name> [description] [--dry-run]\n')
    console.error('Example:')
    console.error('  agenthood create my-cool-skill "Reviews terraform plans for drift"\n')
    process.exit(1)
    return
  }

  // same spec-shaped gate as install/remove — a hostile arg must not escape the skills dir
  if (!SPEC_NAME_RE.test(name)) {
    console.error(`  ✗ Invalid skill name "${name}" — must match ${SPEC_NAME_RE}`)
    process.exit(1)
    return
  }

  if (MEMBER_NAMES.includes(name)) {
    console.error(`  ✗ "${name}" is a Society member name — reserved, choose another`)
    process.exit(1)
    return
  }

  const skillsDir = resolveSkillsDir(process.cwd())
  const skillFile = join(skillsDir, name, 'SKILL.md')

  if (existsSync(skillFile)) {
    console.error(`  ✗ ${skillFile} already exists`)
    process.exit(1)
    return
  }

  const desc = description || `TODO — describe what ${name} does and when to use it`

  if (dryRun) {
    console.log(`\n  Dry run — would create ${skillFile}\n`)
    return
  }

  mkdirSync(join(skillsDir, name), { recursive: true })
  writeFileSync(skillFile, template(name, desc), 'utf-8')
  console.log(`  ✓ Created ${skillFile}`)
  console.log('  Next: fill in the Overview and When to Use sections, then publish it with `agenthood publish`.\n')
}
