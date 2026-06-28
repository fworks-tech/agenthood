import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface Lockfile {
  version: number
  members: Record<string, { version: string; updatedAt: string }>
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
