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
  toolCalls?: { id: string; name: string; args: unknown }[]
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

/** The subset of RunCheckpoint the runner depends on — hosts may substitute their own store. */
export interface CheckpointStore {
  load(id: string): CheckpointData | undefined
  save(data: CheckpointData): void
  updateStatus(id: string, status: CheckpointData['status']): void
}

function getCheckpointDir(cwd: string): string {
  return join(cwd, CHECKPOINT_DIR)
}

/** Ids become file names — anything outside this charset could escape the folder. */
function checkpointPath(dir: string, id: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) {
    throw new Error(`Invalid checkpoint id: "${id}" — must match [a-zA-Z0-9_-]+`)
  }
  return join(dir, `${id}.json`)
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
    const filePath = checkpointPath(this.dir, data.id)
    data.updatedAt = new Date().toISOString()
    writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
  }

  load(id: string): CheckpointData | undefined {
    const filePath = checkpointPath(this.dir, id)
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
