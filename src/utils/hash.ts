import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

export function contentHash(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex')
}

// Raw-byte SHA-256 for resource files (scripts, references) that may not be
// UTF-8 text — contentHash would corrupt binary content via utf8 decoding.
export function fileHash(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

function shortHash(pattern: string): string {
  return createHash('sha256').update(pattern, 'utf8').digest('hex').slice(0, 8)
}

export function hashPattern(pattern: string): string {
  return `v1:${shortHash(pattern)}`
}
