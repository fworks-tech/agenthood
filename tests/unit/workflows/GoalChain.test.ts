import { describe, it, expect, vi } from 'vitest'
import { GoalChain } from '../../../src/workflows/GoalChain.js'
import type { LongTermMemory } from '../../../src/core/types.js'

function mockMemory(): LongTermMemory {
  const store = new Map<string, unknown>()
  return {
    store: vi.fn(async (key: string, value: unknown) => { store.set(key, value) }),
    retrieve: vi.fn(async (key: string) => store.get(key) ?? null),
  }
}

describe('GoalChain', () => {
  it('creates a goal and persists it', async () => {
    const chain = new GoalChain(mockMemory())
    const goal = await chain.create('implement auth', '#42')

    expect(goal.description).toBe('implement auth')
    expect(goal.issueRef).toBe('#42')
    expect(goal.status).toBe('pending')
    expect(goal.subGoals).toHaveLength(0)
  })

  it('adds sub-goals to an existing goal', async () => {
    const chain = new GoalChain(mockMemory())
    const goal = await chain.create('implement auth')

    const sg = await chain.addSubGoal(goal.id, { description: 'add login page', workflowId: undefined })

    const updated = await chain.getGoal(goal.id)
    expect(updated!.subGoals).toHaveLength(1)
    expect(updated!.subGoals[0].description).toBe('add login page')
    expect(sg.status).toBe('pending')
  })

  it('updates sub-goal status', async () => {
    const chain = new GoalChain(mockMemory())
    const goal = await chain.create('implement auth')
    const sg = await chain.addSubGoal(goal.id, { description: 'add login page' })

    await chain.updateStatus(goal.id, sg.id, 'completed')

    const updated = await chain.getGoal(goal.id)
    expect(updated!.subGoals[0].status).toBe('completed')
    expect(updated!.subGoals[0].completedAt).toBeDefined()
  })

  it('marks goal as completed when all sub-goals done', async () => {
    const chain = new GoalChain(mockMemory())
    const goal = await chain.create('implement auth')
    const sg1 = await chain.addSubGoal(goal.id, { description: 'login page' })
    const sg2 = await chain.addSubGoal(goal.id, { description: 'auth middleware' })

    await chain.updateStatus(goal.id, sg1.id, 'completed')
    await chain.updateStatus(goal.id, sg2.id, 'completed')

    const updated = await chain.getGoal(goal.id)
    expect(updated!.status).toBe('completed')
  })

  it('resume finds next pending sub-goal', async () => {
    const chain = new GoalChain(mockMemory())
    const goal = await chain.create('implement auth')
    const sg1 = await chain.addSubGoal(goal.id, { description: 'login page' })
    await chain.addSubGoal(goal.id, { description: 'auth middleware' })

    await chain.updateStatus(goal.id, sg1.id, 'completed')

    const next = await chain.resume(goal.id)
    expect(next).toBeDefined()
    expect(next!.description).toBe('auth middleware')
    expect(next!.status).toBe('in_progress')
  })

  it('resume returns undefined when no pending sub-goals', async () => {
    const chain = new GoalChain(mockMemory())
    const goal = await chain.create('implement auth')
    const sg = await chain.addSubGoal(goal.id, { description: 'login page' })
    await chain.updateStatus(goal.id, sg.id, 'completed')

    const next = await chain.resume(goal.id)
    expect(next).toBeUndefined()
  })

  it('getActive returns only non-completed goals', async () => {
    const chain = new GoalChain(mockMemory())
    const g1 = await chain.create('goal 1')
    const g2 = await chain.create('goal 2')
    const sg1 = await chain.addSubGoal(g1.id, { description: 'sub' })
    await chain.updateStatus(g1.id, sg1.id, 'completed')
    // g1 should now be completed

    const active = await chain.getActive()
    expect(active.some((g) => g.id === g1.id)).toBe(false)
    expect(active.some((g) => g.id === g2.id)).toBe(true)
  })

  it('throws for unknown goal', async () => {
    const chain = new GoalChain(mockMemory())
    await expect(chain.addSubGoal('nonexistent', { description: 'test' })).rejects.toThrow('Goal not found')
  })
})
