import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { TrajectoryStore, type Trajectory } from '../../../src/core/TrajectoryStore.ts'

function trajectory(id: string): Trajectory {
  const now = new Date().toISOString()
  return {
    id,
    correlationId: 'corr-1',
    member: 'scribe',
    task: 'write a commit message',
    steps: [],
    totalTokens: 0,
    totalCost: 0,
    totalDurationMs: 0,
    startedAt: now,
    completedAt: now,
  }
}

describe('TrajectoryStore', () => {
  let projectDir: string

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), 'agenthood-traj-'))
  })

  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true })
  })

  it('drops the oldest trajectory once the cap is exceeded', () => {
    const store = new TrajectoryStore(projectDir, 2)
    store.save(trajectory('first'))
    store.save(trajectory('second'))
    store.save(trajectory('third'))

    const files = readdirSync(join(projectDir, '.agenthood', 'trajectories')).filter((f) => f.endsWith('.json'))
    expect(files).toHaveLength(2)
    expect(files).toContain('third.json')
  })
})
