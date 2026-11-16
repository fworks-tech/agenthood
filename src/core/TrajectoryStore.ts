import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** `list()` parses every file, so the directory must not grow forever. */
const MAX_TRAJECTORIES = 1000

/** One tool call inside a ReAct step; a step may call several. */
export interface TrajectoryToolCall {
  name: string
  input: string
  output: string
  status: 'success' | 'error'
}

export interface TrajectoryStep {
  step: number
  model: string
  /** Legacy single-tool fields, still read from older trajectory files. */
  tool?: string
  toolInput?: string
  toolOutput?: string
  /** Skills active when the step ran (#605) */
  skills?: string[]
  /** Every tool the step called, in order (#605) */
  tools?: TrajectoryToolCall[]
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

  constructor(
    projectDir: string,
    private readonly maxTrajectories = MAX_TRAJECTORIES,
  ) {
    this.dir = join(projectDir, '.agenthood', 'trajectories')
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true })
    }
  }

  save(trajectory: Trajectory): void {
    const path = join(this.dir, `${trajectory.id}.json`)
    writeFileSync(path, JSON.stringify(trajectory, null, 2) + '\n', 'utf-8')
    this.pruneOverflow()
  }

  private pruneOverflow(): void {
    const files = readdirSync(this.dir).filter((f: string) => f.endsWith('.json'))
    if (files.length <= this.maxTrajectories) return
    const oldest = files
      .map((file) => ({ file, mtime: statSync(join(this.dir, file)).mtimeMs }))
      .sort((a, b) => a.mtime - b.mtime)
    for (const entry of oldest.slice(0, files.length - this.maxTrajectories)) {
      rmSync(join(this.dir, entry.file), { force: true })
    }
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
