import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { SKILLS_LOCKFILE } from '../members.ts'

export interface SkillsLockEntry {
  source: string
  version?: string
  installedAt: string
}

export interface SkillsLockfile {
  version: number
  skills: Record<string, SkillsLockEntry>
}

export function loadSkillsLockfile(skillsDir: string): SkillsLockfile {
  const lockPath = join(skillsDir, SKILLS_LOCKFILE)
  if (!existsSync(lockPath)) return { version: 1, skills: {} }
  try {
    return JSON.parse(readFileSync(lockPath, 'utf-8')) as SkillsLockfile
  } catch {
    return { version: 1, skills: {} }
  }
}

export function saveSkillsLockfile(skillsDir: string, lock: SkillsLockfile): void {
  const lockPath = join(skillsDir, SKILLS_LOCKFILE)
  writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n', 'utf-8')
}
