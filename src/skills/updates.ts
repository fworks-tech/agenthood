import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { MEMBERS_DIR } from '../members/MemberRegistry.ts'
import { SkillParser, parseSkillVersion } from './discovery/SkillParser.ts'

/** Project skill locations, in the order discovery prefers them. */
export const LOCAL_SKILL_DIRS = ['.agents/skills', '.agenthood/skills', '.claude/skills', 'skills']

export type UpdateStatus = 'up-to-date' | 'outdated' | 'ahead' | 'modified' | 'not-installed'

export interface SkillUpdateInfo {
  name: string
  status: UpdateStatus
  localPath?: string
  packagedPath: string
  localVersion?: string
  packagedVersion?: string
}

/** Compare major.minor.patch numerically; a pre-release suffix is ignored for ordering. */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string) => v.split('-')[0].split('.').map(Number)
  const [x, y] = [parts(a), parts(b)]
  for (let i = 0; i < 3; i++) {
    const diff = (x[i] ?? 0) - (y[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

export function classifyUpdate(
  local: { body: string; version?: string },
  packaged: { body: string; version?: string },
): UpdateStatus {
  if (local.version && packaged.version) {
    const order = compareVersions(local.version, packaged.version)
    if (order < 0) return 'outdated'
    if (order > 0) return 'ahead'
    return local.body === packaged.body ? 'up-to-date' : 'modified'
  }
  // No version on one side: content is the only signal.
  return local.body === packaged.body ? 'up-to-date' : 'modified'
}

/**
 * Packaged skills and the project copies of them. "Upstream" is the skill shipped
 * in this installation; a project copy under one of LOCAL_SKILL_DIRS is the
 * candidate to update (#570, #592).
 */
export function collectUpdates(projectPath: string): SkillUpdateInfo[] {
  const parser = new SkillParser()
  const packagedDir = MEMBERS_DIR
  if (!existsSync(packagedDir)) return []

  const updates: SkillUpdateInfo[] = []
  for (const name of packagedNames(packagedDir)) {
    const packagedPath = join(packagedDir, name, 'SKILL.md')
    const packagedRaw = parser.parse(packagedPath)
    if (!packagedRaw) continue

    const localPath = LOCAL_SKILL_DIRS.map((dir) => join(projectPath, dir, name, 'SKILL.md')).find(existsSync)
    if (!localPath) {
      updates.push({ name, status: 'not-installed', packagedPath, packagedVersion: packagedRaw.version })
      continue
    }
    const localRaw = parser.parse(localPath)
    if (!localRaw) continue
    updates.push({
      name,
      status: classifyUpdate(localRaw, packagedRaw),
      localPath,
      packagedPath,
      localVersion: localRaw.version,
      packagedVersion: packagedRaw.version,
    })
  }
  return updates.sort((a, b) => a.name.localeCompare(b.name))
}

function packagedNames(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('the-') && entry.name !== '_shared')
      .map((entry) => entry.name)
  } catch {
    return []
  }
}

/** Read a packaged skill's version without a full parse, for lockfile-free comparisons. */
export function packagedVersion(path: string): string | undefined {
  if (!existsSync(path)) return undefined
  return parseSkillVersion(new SkillParser().parseRaw(readFileSync(path, 'utf8')).frontmatter)
}
