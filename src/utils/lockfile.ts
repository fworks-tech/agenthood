import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface Lockfile {
  version: number
  members: Record<string, LockfileMember>
}

// resources maps member-relative paths (scripts/run.mjs) to SHA-256 hex.
// Absent on pre-#604 locks — readers treat missing as "not yet locked".
export interface LockfileMember {
  version: string
  updatedAt: string
  resources?: Record<string, string>
}

export function loadLockfile(cwd: string): Lockfile | undefined {
  const lockPath = join(cwd, 'agenthood.lock')
  if (!existsSync(lockPath)) return undefined
  try {
    return JSON.parse(readFileSync(lockPath, 'utf8')) as Lockfile
  } catch {
    return undefined
  }
}
