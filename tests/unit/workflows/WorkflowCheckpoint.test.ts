import { describe, it, expect } from 'vitest'
import { WorkflowCheckpoint } from '../../../src/workflows/WorkflowCheckpoint.js'
import type { WorkflowContext } from '../../../src/workflows/types.js'

function makeContext(): WorkflowContext {
  return {
    executionId: 'test',
    artifacts: new Map(),
    stepResults: new Map(),
    metadata: {},
  }
}

describe('WorkflowCheckpoint', () => {
  it('creates a snapshot of current artifacts on save', () => {
    const cp = new WorkflowCheckpoint()
    const ctx = makeContext()
    ctx.artifacts.set('file.ts', { content: 'original' })

    const id = cp.save('step-1', ctx)

    // Mutate original
    ctx.artifacts.set('file.ts', { content: 'modified' })

    // Restore should revert
    cp.restore(id, ctx)

    const restored = ctx.artifacts.get('file.ts') as { content: string }
    expect(restored.content).toBe('original')
  })

  it('restore throws for unknown checkpoint id', () => {
    const cp = new WorkflowCheckpoint()
    const ctx = makeContext()

    expect(() => cp.restore('nonexistent', ctx)).toThrow('Checkpoint not found')
  })

  it('deep clones values so mutations do not affect snapshot', () => {
    const cp = new WorkflowCheckpoint()
    const ctx = makeContext()
    const nested = { deep: { value: 42 } }
    ctx.artifacts.set('config', nested)

    const id = cp.save('step-1', ctx)

    // Mutate original deeply
    nested.deep.value = 99

    cp.restore(id, ctx)
    const restored = ctx.artifacts.get('config') as { deep: { value: number } }
    expect(restored.deep.value).toBe(42)
  })

  it('multiple checkpoints can exist simultaneously', () => {
    const cp = new WorkflowCheckpoint()
    const ctx = makeContext()

    ctx.artifacts.set('a', 1)
    const id1 = cp.save('step-1', ctx)

    ctx.artifacts.set('b', 2)
    const id2 = cp.save('step-2', ctx)

    expect(cp.count()).toBe(2)

    cp.restore(id1, ctx)
    expect(ctx.artifacts.has('b')).toBe(false)
    expect(ctx.artifacts.get('a')).toBe(1)
  })

  it('clear removes a checkpoint', () => {
    const cp = new WorkflowCheckpoint()
    const ctx = makeContext()

    const id = cp.save('step-1', ctx)
    expect(cp.count()).toBe(1)

    cp.clear(id)
    expect(cp.count()).toBe(0)
  })

  it('getLatest returns the most recent checkpoint', () => {
    const cp = new WorkflowCheckpoint()
    const ctx = makeContext()

    cp.save('step-1', ctx)
    const id2 = cp.save('step-2', ctx)

    const latest = cp.getLatest()
    expect(latest!.stepName).toBe('step-2')
    expect(latest!.id).toBe(id2)
  })

  it('clearAll removes all checkpoints', () => {
    const cp = new WorkflowCheckpoint()
    const ctx = makeContext()

    cp.save('step-1', ctx)
    cp.save('step-2', ctx)
    expect(cp.count()).toBe(2)

    cp.clearAll()
    expect(cp.count()).toBe(0)
  })
})
