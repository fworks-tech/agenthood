import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync } from 'node:fs'
import { join } from 'node:path'

export interface CostEntry {
  timestamp: string
  member: string
  model: string
  provider: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  costUsd: number
  // Skills activated during this step (step 1+ only; empty on step 0): the
  // per-activation dimension `cost --skill` and stats aggregate on (#624).
  skills?: string[]
}

/** Rotate at this size so the hot file stays small; older logs stay readable. */
const MAX_COST_LOG_BYTES = 8 * 1024 * 1024
const COST_FILE_RE = /^costs(?:\.\d+)?\.jsonl$/

export function logCost(entry: CostEntry, cwd: string = process.cwd()): void {
  const dir = join(cwd, '.agenthood')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const filePath = join(dir, 'costs.jsonl')
  try {
    if (existsSync(filePath) && statSync(filePath).size >= MAX_COST_LOG_BYTES) {
      renameSync(filePath, join(dir, `costs.${Date.now()}.jsonl`))
    }
  } catch {
    // another process rotated it first: appending creates the fresh file
  }
  const line = JSON.stringify(entry) + '\n'
  appendFileSync(filePath, line, 'utf8')
}

/** Reads the current log and its rotations. A line torn by a crash is skipped:
 *  one bad line must not make every later cost report throw. */
export function readCosts(cwd: string = process.cwd()): CostEntry[] {
  const dir = join(cwd, '.agenthood')
  if (!existsSync(dir)) return []
  const costs: CostEntry[] = []
  for (const file of readdirSync(dir).filter((f) => COST_FILE_RE.test(f)).sort()) {
    let content: string
    try {
      content = readFileSync(join(dir, file), 'utf8')
    } catch {
      continue
    }
    for (const line of content.split('\n')) {
      if (!line.trim()) continue
      try {
        costs.push(JSON.parse(line) as CostEntry)
      } catch {
        // skip a line torn by a crash or a full disk
      }
    }
  }
  return costs
}
