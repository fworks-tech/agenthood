import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { CommandDescriptor } from './types.ts'
import { MEMBER_NAMES, resolveSocietyMembersDir } from '../members.ts'
import { SkillParser, parseLicense } from '../skills/discovery/SkillParser.ts'
import { userError } from '../core/cliError.ts'

export const command: CommandDescriptor = {
  name: 'license',
  description: 'Show the SPDX license declared by each member, or by one member',
  handler: (args) => license(args),
}

export async function license(args: string[]): Promise<void> {
  const target = args.find((arg) => !arg.startsWith('--'))
  if (target && !MEMBER_NAMES.includes(target)) {
    userError(`"${target}" is not a member`, { fix: `Pick one of: ${MEMBER_NAMES.join(', ')}` })
  }

  const membersDir = resolveSocietyMembersDir()
  const parser = new SkillParser()
  const rows: [string, string][] = []
  for (const member of target ? [target] : MEMBER_NAMES) {
    const skillPath = join(membersDir, member, 'SKILL.md')
    if (!existsSync(skillPath)) continue
    const declared = parseLicense(parser.parseRaw(readFileSync(skillPath, 'utf8')).frontmatter)
    rows.push([member, declared ?? '(none declared)'])
  }

  if (rows.length === 0) {
    userError('No member SKILL.md found', { fix: `Expected them under ${membersDir}` })
  }
  const width = Math.max(...rows.map(([member]) => member.length))
  for (const [member, declared] of rows) {
    console.log(`  ${member.padEnd(width)}  ${declared}`)
  }
}
