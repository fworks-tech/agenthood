import { existsSync } from 'node:fs'
import { join } from 'node:path'

export interface ResolvedSkillFile {
  path: string
  fileName: string
  nonCanonical: boolean
}

// Prefer SKILL.md; fall back to lowercase skill.md for skills authored in
// other clients. Callers warn on nonCanonical and suggest a rename.
export function resolveSkillFile(dir: string): ResolvedSkillFile | undefined {
  const canonical = join(dir, 'SKILL.md')
  if (existsSync(canonical)) return { path: canonical, fileName: 'SKILL.md', nonCanonical: false }
  const lower = join(dir, 'skill.md')
  if (existsSync(lower)) return { path: lower, fileName: 'skill.md', nonCanonical: true }
  return undefined
}
