/**
 * Per-repo agent instruction file (#567).
 *
 * AGENTS.md is the cross-client convention; CLAUDE.md is the older alias. The
 * runtime reads either as read-only project guidance and never writes them,
 * these files belong to the repository, not to agenthood.
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Instruction files in precedence order. AGENTS.md is the cross-client convention. */
const CANDIDATES = ['AGENTS.md', 'CLAUDE.md'] as const

/** Hard ceiling. The file is agent guidance, not a data channel; an oversized
 *  one is truncated rather than allowed to dominate the context window. */
export const MAX_REPO_INSTRUCTIONS_BYTES = 64 * 1024

export function loadRepoInstructions(projectPath: string): string {
  for (const name of CANDIDATES) {
    const path = join(projectPath, name)
    if (!existsSync(path)) continue
    let raw: string
    try {
      raw = readFileSync(path, 'utf-8')
    } catch (err) {
      console.warn(`[run] cannot read ${name}: ${(err as Error)?.message ?? err}`)
      continue
    }
    // Windows editors may prepend a BOM, which would leave a stray character on
    // the first line. Strip it here, the single read chokepoint.
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1)
    const text = raw.trim()
    if (!text) continue

    const bytes = Buffer.byteLength(text, 'utf-8')
    if (bytes <= MAX_REPO_INSTRUCTIONS_BYTES) return text
    return `${Buffer.from(text, 'utf-8').subarray(0, MAX_REPO_INSTRUCTIONS_BYTES).toString('utf-8')}\n\n[truncated at ${MAX_REPO_INSTRUCTIONS_BYTES} bytes]`
  }
  return ''
}
