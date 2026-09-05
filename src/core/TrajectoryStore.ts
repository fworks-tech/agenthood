import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export interface TrajectoryStep {
  step: number
  model: string
  tool?: string
  toolInput?: string
  toolOutput?: string
  inputSummary: string
  outputSummary: string
  tokens: { prompt: number; completion: number }
  cost: number
  durationMs: number
  status: 'success' | 'error' | 'retry' | 'human-input'
  humanDecision?: 'approved' | 'rejected' | 'edited' | 'skipped'
}

export interface Trajectory {
  id: string
  correlationId: string
  member: string
  task: string
  steps: TrajectoryStep[]
  totalTokens: number
  totalCost: number
  totalDurationMs: number
  startedAt: string
  completedAt: string
}

export class TrajectoryStore {
  private readonly dir: string

  constructor(projectDir: string) {
    this.dir = join(projectDir, '.agenthood', 'trajectories')
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true })
    }
  }

  save(trajectory: Trajectory): void {
    const path = join(this.dir, `${trajectory.id}.json`)
    writeFileSync(path, JSON.stringify(trajectory, null, 2) + '\n', 'utf-8')
  }

  load(id: string): Trajectory | undefined {
    const path = join(this.dir, `${id}.json`)
    if (!existsSync(path)) return undefined
    try {
      return JSON.parse(readFileSync(path, 'utf-8')) as Trajectory
    } catch {
      return undefined
    }
  }

  list(): Trajectory[] {
    if (!existsSync(this.dir)) return []
    const { readdirSync } = require('node:fs') as typeof import('node:fs')
    const files = readdirSync(this.dir).filter((f: string) => f.endsWith('.json'))
    const trajectories: Trajectory[] = []
    for (const file of files) {
      try {
        const data = JSON.parse(readFileSync(join(this.dir, file), 'utf-8')) as Trajectory
        trajectories.push(data)
      } catch {
        // skip corrupt files
      }
    }
    return trajectories.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  }
}
