import type { LongTermMemory } from '../core/types.js'

export type GoalStatus = 'pending' | 'in_progress' | 'blocked' | 'completed'

export interface Goal {
  id: string
  description: string
  issueRef?: string
  subGoals: SubGoal[]
  status: GoalStatus
  createdAt: string
  updatedAt: string
}

export interface SubGoal {
  id: string
  description: string
  workflowId?: string
  status: GoalStatus
  completedAt?: string
}

const GOALS_INDEX_KEY = 'goals:index'

function isGoal(value: unknown): value is Goal {
  if (typeof value !== 'object' || value === null) return false
  const g = value as Record<string, unknown>
  return (
    typeof g.id === 'string' &&
    typeof g.description === 'string' &&
    Array.isArray(g.subGoals) &&
    ['pending', 'in_progress', 'blocked', 'completed'].includes(g.status as string) &&
    typeof g.createdAt === 'string' &&
    typeof g.updatedAt === 'string'
  )
}

export class GoalChain {
  private memory: LongTermMemory
  private goals: Goal[] = []

  constructor(memory: LongTermMemory) {
    this.memory = memory
  }

  async create(description: string, issueRef?: string): Promise<Goal> {
    const goal: Goal = {
      id: `goal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      description,
      issueRef,
      subGoals: [],
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    await this.saveGoal(goal)
    await this.updateIndex(goal.id, 'add')
    this.goals.push(goal)

    return goal
  }

  async addSubGoal(goalId: string, subGoal: Omit<SubGoal, 'id' | 'status'>): Promise<SubGoal> {
    const goal = await this.getGoal(goalId)
    if (!goal) throw new Error(`Goal not found: "${goalId}"`)

    const sg: SubGoal = {
      ...subGoal,
      id: `sg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      status: 'pending',
    }

    goal.subGoals.push(sg)
    goal.updatedAt = new Date().toISOString()
    if (goal.status === 'pending') goal.status = 'in_progress'

    await this.saveGoal(goal)
    return sg
  }

  async updateStatus(goalId: string, subGoalId: string, status: GoalStatus): Promise<void> {
    const goal = await this.getGoal(goalId)
    if (!goal) throw new Error(`Goal not found: "${goalId}"`)

    const sg = goal.subGoals.find((s) => s.id === subGoalId)
    if (!sg) throw new Error(`SubGoal not found: "${subGoalId}" in goal "${goalId}"`)

    sg.status = status
    if (status === 'completed') sg.completedAt = new Date().toISOString()

    goal.updatedAt = new Date().toISOString()

    const allDone = goal.subGoals.every((s) => s.status === 'completed')
    if (allDone && goal.subGoals.length > 0) goal.status = 'completed'

    await this.saveGoal(goal)
  }

  async getActive(): Promise<Goal[]> {
    await this.loadGoals()
    return this.goals.filter((g) => g.status === 'pending' || g.status === 'in_progress' || g.status === 'blocked')
  }

  async resume(goalId: string): Promise<SubGoal | undefined> {
    const goal = await this.getGoal(goalId)
    if (!goal) throw new Error(`Goal not found: "${goalId}"`)

    const next = goal.subGoals.find((s) => s.status === 'pending')
    if (next) {
      next.status = 'in_progress'
      goal.updatedAt = new Date().toISOString()
      await this.saveGoal(goal)
    }

    return next
  }

  async getGoal(goalId: string): Promise<Goal | undefined> {
    const existing = this.goals.find((g) => g.id === goalId)
    if (existing) return existing

    const raw = await this.memory.retrieve(`goals:${goalId}`)
    if (raw && isGoal(raw)) {
      this.goals.push(raw)
      return raw
    }
    return undefined
  }

  private async saveGoal(goal: Goal): Promise<void> {
    await this.memory.store(`goals:${goal.id}`, goal)
  }

  private async updateIndex(goalId: string, _action: 'add' | 'remove'): Promise<void> {
    const raw = await this.memory.retrieve(GOALS_INDEX_KEY)
    const index: string[] = raw && Array.isArray(raw) ? (raw as string[]) : []
    if (!index.includes(goalId)) {
      index.push(goalId)
      await this.memory.store(GOALS_INDEX_KEY, index)
    }
  }

  private async loadGoals(): Promise<void> {
    const raw = await this.memory.retrieve(GOALS_INDEX_KEY)
    const goalIds: string[] = raw ? (raw as string[]) : []

    for (const id of goalIds) {
      if (this.goals.some((g) => g.id === id)) continue
      const goal = await this.getGoal(id)
      if (goal) this.goals.push(goal)
    }
  }
}
