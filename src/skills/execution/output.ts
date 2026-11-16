/**
 * Output handling for script runs (#544). Inline output is capped; above the
 * cap the full stream goes to a log file and the model gets the path plus the
 * head and tail, so the middle is never silently lost.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const MAX_INLINE_BYTES = 30 * 1024
export const HEAD_LINES = 50
export const TAIL_LINES = 50
export const DEFAULT_PAGE_SIZE = 200

export interface CappedOutput {
  text: string
  truncated: boolean
}

/** Keeps the byte cap honest even for one enormous line. */
export function capBytes(text: string, maxBytes = MAX_INLINE_BYTES): CappedOutput {
  if (Buffer.byteLength(text, 'utf8') <= maxBytes) return { text, truncated: false }
  const buffer = Buffer.from(text, 'utf8').subarray(0, maxBytes)
  return { text: `${buffer.toString('utf8')}\n[output truncated]`, truncated: true }
}

export function headAndTail(text: string, head = HEAD_LINES, tail = TAIL_LINES): string {
  const lines = text.split('\n')
  if (lines.length <= head + tail) return text
  return [...lines.slice(0, head), `[${lines.length - head - tail} lines omitted]`, ...lines.slice(-tail)].join('\n')
}

/** Where a run's spilled output lives; one directory per execution. */
export function outputLogPath(projectPath: string, executionId: string, script: string): string {
  const safe = script.replace(/[^a-zA-Z0-9_.-]+/g, '_')
  return join(projectPath, '.agenthood', 'skill-output', executionId, `${safe}.log`)
}

/** Writes the log 0600 and returns its path. */
export function spillOutput(projectPath: string, executionId: string, script: string, text: string): string {
  const path = outputLogPath(projectPath, executionId, script)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, text, { encoding: 'utf8', mode: 0o600 })
  return path
}

/** One 1-based page of a file, 200 lines by default. */
export function pageLines(text: string, page = 1, pageSize = DEFAULT_PAGE_SIZE): string {
  const lines = text.split('\n')
  const size = Math.max(1, pageSize)
  const start = Math.max(0, (Math.max(1, page) - 1) * size)
  return lines.slice(start, start + size).join('\n')
}
