/**
 * RunCheckpoint — persists member run state after each reasoning step.
 *
 * Enables resuming interrupted runs via `agenthood run --resume <id>`.
 * Checkpoints are stored as JSON files in `.agenthood/checkpoints/`.
 */

import { existsSync, readFileSync, writeFileSync, readdirSync, unlinkSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

export interface CheckpointMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  toolCallId?: string
}

export interface CheckpointUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface CheckpointData {
  id: string
  member: string
  task: string
  step: number
  messages: CheckpointMessage[]
  usage: CheckpointUsage
  model: string
  activatedSkills: string[]
  status: 'running' | 'completed' | 'failed' | 'interrupted'
  createdAt: string
  updatedAt: string
}

const CHECKPOINT_DIR = '.agenthood/checkpoints'
const DEFAULT_TTL_DAYS = 7

function getCheckpointDir(cwd: string): string {
  return join(cwd, CHECKPOINT_DIR)
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

export class RunCheckpoint {
  private dir: string

  constructor(cwd: string) {
    this.dir = getCheckpointDir(cwd)
  }

  save(data: CheckpointData): void {
    ensureDir(this.dir)
    const filePath = join(this.dir, `${data.id}.json`)
    data.updatedAt = new Date().toISOString()
    writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
  }

  load(id: string): CheckpointData | undefined {
    const filePath = join(this.dir, `${id}.json`)
    if (!existsSync(filePath)) return undefined
    try {
      return JSON.parse(readFileSync(filePath, 'utf-8'))
    } catch {
      return undefined
    }
  }

  list(): CheckpointData[] {
    if (!existsSync(this.dir)) return []
    const files = readdirSync(this.dir).filter((f) => f.endsWith('.json'))
    const checkpoints: CheckpointData[] = []
    for (const file of files) {
      try {
        const data = JSON.parse(readFileSync(join(this.dir, file), 'utf-8'))
        checkpoints.push(data)
      } catch {
        // skip corrupted files
      }
    }
    return checkpoints.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }

  updateStatus(id: string, status: CheckpointData['status']): void {
    const data = this.load(id)
    if (!data) return
    data.status = status
    data.updatedAt = new Date().toISOString()
    this.save(data)
  }

  prune(ttlDays: number = DEFAULT_TTL_DAYS): number {
    if (!existsSync(this.dir)) return 0
    const cutoff = Date.now() - ttlDays * 24 * 60 * 60 * 1000
    const files = readdirSync(this.dir).filter((f) => f.endsWith('.json'))
    let pruned = 0
    for (const file of files) {
      try {
        const data = JSON.parse(readFileSync(join(this.dir, file), 'utf-8'))
        if (new Date(data.updatedAt).getTime() < cutoff) {
          unlinkSync(join(this.dir, file))
          pruned++
        }
      } catch {
        // skip corrupted files
      }
    }
    return pruned
  }

  static generateId(correlationId: string): string {
    return correlationId
  }
}
