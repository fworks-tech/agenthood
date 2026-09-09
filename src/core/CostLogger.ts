import { appendFileSync, existsSync, mkdirSync } from 'node:fs'
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
  const path = join(cwd, '.agenthood', 'costs.jsonl')
  if (!existsSync(path)) return []
  const lines = require('node:fs').readFileSync(path, 'utf8').trim().split('\n')
  return lines.filter((l: string) => l.length > 0).map((l: string) => JSON.parse(l) as CostEntry)
}
