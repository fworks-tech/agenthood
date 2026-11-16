import { describe, it, expect, afterEach } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  MAX_INLINE_BYTES,
  capBytes,
  headAndTail,
  outputLogPath,
  pageLines,
  spillOutput,
} from '../../../src/skills/execution/output.ts'

let dir: string
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true })
})

describe('capped script output (#544)', () => {
  it('leaves output under the cap untouched', () => {
    expect(capBytes('short')).toEqual({ text: 'short', truncated: false })
  })

  it('cuts an oversized stream at the byte cap and says so', () => {
    const result = capBytes('x'.repeat(MAX_INLINE_BYTES + 10))
    expect(result.truncated).toBe(true)
    expect(result.text).toContain('[output truncated]')
    expect(Buffer.byteLength(result.text, 'utf8')).toBeLessThan(MAX_INLINE_BYTES + 100)
  })

  it('keeps the first and last lines of a long stream and names the gap', () => {
    const numbered = Array.from({ length: 300 }, (_, i) => `line ${i + 1}`).join('\n')
    const preview = headAndTail(numbered)
    expect(preview).toContain('line 1\n')
    expect(preview).toContain('line 300')
    expect(preview).toContain('200 lines omitted')
  })

  it('pages a spilled file 1-based', () => {
    const text = Array.from({ length: 10 }, (_, i) => `line ${i}`).join('\n')
    expect(pageLines(text, 2, 3)).toBe('line 3\nline 4\nline 5')
  })

  it('writes the full stream to a per-run log and returns its path', () => {
    dir = mkdtempSync(join(tmpdir(), 'skill-output-'))
    const path = spillOutput(dir, 'exec-1', 'scripts/big.py', 'a'.repeat(MAX_INLINE_BYTES + 1))
    expect(path).toBe(outputLogPath(dir, 'exec-1', 'scripts/big.py'))
    expect(existsSync(path)).toBe(true)
    expect(readFileSync(path, 'utf8')).toHaveLength(MAX_INLINE_BYTES + 1)
  })
})
