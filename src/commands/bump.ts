import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { CommandDescriptor } from './types.ts'
import { MEMBER_NAMES, resolveSocietyMembersDir } from '../members.ts'
import { SkillParser, parseSkillVersion, SEMVER_RE } from '../skills/discovery/SkillParser.ts'
import { updateLockfile } from './verify.ts'
import { userError } from '../core/cliError.ts'

export type BumpLevel = 'major' | 'minor' | 'patch'

/** Increment a semver string. A pre-release or build suffix is dropped by the bump. */
export function bumpVersion(version: string, level: BumpLevel): string {
  const match = SEMVER_RE.exec(version)
  if (!match) throw new Error(`"${version}" is not semver`)
  let [major, minor, patch] = [Number(match[1]), Number(match[2]), Number(match[3])]
  if (level === 'major') {
    major++
    minor = 0
    patch = 0
  } else if (level === 'minor') {
    minor++
    patch = 0
  } else {
    patch++
  }
  return `${major}.${minor}.${patch}`
}

/**
 * Rewrite `metadata.version` in a SKILL.md, leaving the rest of the file byte-identical.
 * Only the two-space-indented key is replaced, so a nested `version` elsewhere
 * (a dependency pin, say) is never touched.
 */
export function setSkillVersion(content: string, next: string): string {
  const lines = content.split('\n')
  const start = lines.findIndex((line) => /^metadata:[ \t]*$/.test(line))
  if (start === -1) throw new Error('no "metadata:" block to hold the version')
  let end = start + 1
  while (end < lines.length && /^[ \t]+\S/.test(lines[end])) end++
  for (let i = start + 1; i < end; i++) {
    if (/^ {2}version:[ \t]*/.test(lines[i])) {
      lines[i] = lines[i].replace(/^ {2}version:[ \t]*.*$/, `  version: ${next}`)
      return lines.join('\n')
    }
  }
  lines.splice(start + 1, 0, `  version: ${next}`)
  return lines.join('\n')
}

export const command: CommandDescriptor = {
  name: 'bump',
  description: 'Increment a member skill version (metadata.version) and re-lock it',
  handler: (args) => bump(args),
}

export async function bump(args: string[]): Promise<void> {
  const member = args.find((arg) => !arg.startsWith('--'))
  const levels = (['major', 'minor', 'patch'] as BumpLevel[]).filter((level) => args.includes(`--${level}`))

  if (!member) {
    userError('bump needs a member name', { fix: 'Run `agenthood bump <member> --patch|--minor|--major`' })
  }
  if (!MEMBER_NAMES.includes(member)) {
    userError(`"${member}" is not a member`, { fix: `Pick one of: ${MEMBER_NAMES.join(', ')}` })
  }
  if (levels.length !== 1) {
    userError('bump needs exactly one level', { fix: 'Pass one of --patch, --minor, --major' })
  }

  const cwd = process.cwd()
  const membersDir = resolveSocietyMembersDir()
  const skillPath = join(membersDir, member, 'SKILL.md')
  if (!existsSync(skillPath)) {
    userError(`No SKILL.md for "${member}"`, { fix: `Expected ${skillPath}` })
  }

  const content = readFileSync(skillPath, 'utf8')
  const current = parseSkillVersion(new SkillParser().parseRaw(content).frontmatter)
  if (!current) {
    userError(`"${member}" declares no metadata.version`, {
      fix: 'Add metadata:\\n  version: 1.0.0 to the frontmatter, then re-run bump',
    })
  }
  if (!SEMVER_RE.test(current)) {
    userError(`"${member}" declares metadata.version "${current}", which is not semver`, {
      fix: 'Use major.minor.patch, e.g. 1.4.0',
    })
  }

  const next = bumpVersion(current, levels[0])
  writeFileSync(skillPath, setSkillVersion(content, next), 'utf8')
  // The lock hashes this file, so a bumped version is a changed skill — re-lock
  // here instead of leaving the author to hit drift on the next verify.
  updateLockfile(cwd, membersDir, [member])
  console.log(`\n  ${member}: ${current} → ${next}\n`)
}
