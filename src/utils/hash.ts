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

function polynomialHash(pattern: string): string {
  let hash = 0
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}

export function hashPattern(pattern: string): string {
  return `v1:${polynomialHash(pattern)}`
}
