import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
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
}

export function logCost(entry: CostEntry, cwd: string = process.cwd()): void {
  const dir = join(cwd, '.agenthood')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const line = JSON.stringify(entry) + '\n'
  appendFileSync(join(dir, 'costs.jsonl'), line, 'utf8')
}

export function readCosts(cwd: string = process.cwd()): CostEntry[] {
  const filePath = join(cwd, '.agenthood', 'costs.jsonl')
  if (!existsSync(filePath)) return []
  const content = readFileSync(filePath, 'utf8').trim()
  if (!content) return []
  return content.split('\n').map((l: string) => JSON.parse(l) as CostEntry)
}
