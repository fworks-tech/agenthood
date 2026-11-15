import { renameSync, writeFileSync } from 'node:fs'

/**
 * Writes via a sibling temp file and renames it into place, so a crash or a
 * full disk leaves the previous content intact instead of a truncated file.
 * Callers that read-modify-write state must use this: a half-written JSON file
 * is unreadable, and every reader treats an unreadable file as "no data".
 */
export function writeFileAtomic(path: string, content: string): void {
  const tmp = `${path}.${process.pid}.tmp`
  writeFileSync(tmp, content, 'utf8')
  renameSync(tmp, path)
}
