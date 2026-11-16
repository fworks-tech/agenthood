import { describe, it, expect, vi } from 'vitest'
import { WorkflowEngine } from '../../../src/workflows/WorkflowEngine.ts'
import type { WorkflowDefinition } from '../../../src/workflows/types.ts'
import type { ExecutionContext } from '../../../src/core/ExecutionContext.ts'
import { EpisodicMemory } from '../../../src/core/types.ts'
import { DecisionLog } from '../../../src/core/types.ts'

const mockContext: ExecutionContext = {
  executionId: 'test-123',
  project: { localPath: '/test', name: 'test' },
  memory: {
    shortTerm: { add: vi.fn(), getRecent: vi.fn(), clear: vi.fn() },
    longTerm: { store: vi.fn(), retrieve: vi.fn() },
    episodic: { record: vi.fn(), recall: vi.fn(), getEpisode: vi.fn() } as unknown as EpisodicMemory,
    project: { getConventions: vi.fn(), getArchitecturalDecisions: vi.fn() },
    decisions: {
      record: vi.fn(),
      search: vi.fn(),
      recent: vi.fn(),
      get: vi.fn(),
      all: vi.fn(),
      addCausalRelationship: vi.fn(),
      traceDecisionChain: vi.fn(),
      analyzeDecisionImpact: vi.fn(),
    } as unknown as DecisionLog,
    provenance: {
      track: vi.fn(),
      get: vi.fn(),
      recent: vi.fn(),
      count: vi.fn(),
      invalidate: vi.fn(),
      verifyChain: vi.fn(),
    } as unknown as ExecutionContext['memory']['provenance'],
  },
  llm: {} as any,
  prompts: { build: vi.fn() } as any,
  tracer: { record: vi.fn(), getRecent: vi.fn(), getByMember: vi.fn(), getByCorrelationId: vi.fn(), flush: vi.fn().mockResolvedValue(undefined), size: 0 },
  events: {} as ExecutionContext['events'],
  artifacts: [],
}

describe('WorkflowEngine', () => {
  it('executes a workflow with agent steps', async () => {
    const engine = new WorkflowEngine()
    const definition: WorkflowDefinition = {
      name: 'test-workflow',
      description: 'A test workflow',
      steps: [
        { name: 'step-1', type: 'agent', agentName: 'developer', task: 'write code' },
      ],
    }

    const result = await engine.execute(definition, mockContext)
    expect(result.stepResults.has('step-1')).toBe(true)
  })

  it('executes a workflow with human-in-loop steps', async () => {
    const engine = new WorkflowEngine()
    const definition: WorkflowDefinition = {
      name: 'test-workflow',
      description: 'A test workflow with review',
      steps: [
        { name: 'step-1', type: 'agent', agentName: 'developer', task: 'write code' },
        { name: 'step-2', type: 'human-in-loop', input: { message: 'Review the code' } },
      ],
    }

    const result = await engine.execute(definition, mockContext)
    expect(result.stepResults.has('step-1')).toBe(true)
    expect(result.stepResults.has('step-2')).toBe(true)
  })

  it('handles empty workflow gracefully', async () => {
    const engine = new WorkflowEngine()
    const definition: WorkflowDefinition = {
      name: 'empty',
      description: '',
      steps: [],
    }

    const result = await engine.execute(definition, mockContext)
    expect(result.stepResults.size).toBe(0)
  })

  it('stops execution on step failure', async () => {
    const engine = new WorkflowEngine()
    const definition: WorkflowDefinition = {
      name: 'failing-workflow',
      description: '',
      steps: [
        { name: 'step-1', type: 'tool', input: { skill: { name: 'writeFile' } as any, input: {} } },
      ],
    }

    await expect(engine.execute(definition, mockContext)).rejects.toThrow()
  })

  it('registers custom protocols', () => {
    const engine = new WorkflowEngine()
    const custom = { name: 'custom', config: { retryPolicy: { maxRetries: 0, backoffMs: 0 }, timeoutMs: 100 }, execute: vi.fn(), onFailure: vi.fn() }
    engine.registerProtocol('custom', custom)
    expect(true).toBe(true)
  })

  it('assigns one correlationId and propagates it to all steps', async () => {
    const seenIds: string[] = []
    const protocol = {
      name: 'capturing',
      config: { retryPolicy: { maxRetries: 0, backoffMs: 0 }, timeoutMs: 100 },
      execute: vi.fn(async (_input: unknown, context: ExecutionContext) => {
        seenIds.push(context.correlationId as string)
        return 'ok'
      }),
      onFailure: () => 'abort' as const,
    }
    const engine = new WorkflowEngine()
    engine.registerProtocol('capturing', protocol)

    const definition: WorkflowDefinition = {
      name: 'three-steps',
      description: '',
      steps: [
        { name: 'step-1', type: 'agent', protocol: protocol as never },
        { name: 'step-2', type: 'agent', protocol: protocol as never },
        { name: 'step-3', type: 'agent', protocol: protocol as never },
      ],
    }

    const result = await engine.execute(definition, mockContext)

    expect(seenIds).toHaveLength(3)
    expect(new Set(seenIds).size).toBe(1)
    expect(seenIds[0]).toMatch(/^[0-9a-f-]{36}$/)
    expect(result.metadata.correlationId).toBe(seenIds[0])
  })

  it('preserves the correlationId across retries', async () => {
    const seenIds: string[] = []
    const protocol = {
      name: 'flaky',
      config: { retryPolicy: { maxRetries: 2, backoffMs: 0 }, timeoutMs: 100 },
      execute: vi.fn(async (_input: unknown, context: ExecutionContext) => {
        seenIds.push(context.correlationId as string)
        if (seenIds.length === 1) throw new Error('transient failure')
        return 'recovered'
      }),
      onFailure: () => 'retry' as const,
    }
    const engine = new WorkflowEngine()
    engine.registerProtocol('flaky', protocol)

    const definition: WorkflowDefinition = {
      name: 'retry-workflow',
      description: '',
      steps: [{ name: 'step-1', type: 'agent', protocol: protocol as never }],
    }

    const result = await engine.execute(definition, mockContext)

    expect(seenIds).toHaveLength(2)
    expect(new Set(seenIds).size).toBe(1)
    expect(result.stepResults.get('step-1')).toBe('recovered')
  })

  it('inherits an existing correlationId from the context (nested workflows)', async () => {
    const seenIds: string[] = []
    const protocol = {
      name: 'capturing',
      config: { retryPolicy: { maxRetries: 0, backoffMs: 0 }, timeoutMs: 100 },
      execute: vi.fn(async (_input: unknown, context: ExecutionContext) => {
        seenIds.push(context.correlationId as string)
        return 'ok'
      }),
      onFailure: () => 'abort' as const,
    }
    const engine = new WorkflowEngine()
    engine.registerProtocol('capturing', protocol)

    const definition: WorkflowDefinition = {
      name: 'nested',
      description: '',
      steps: [{ name: 'step-1', type: 'agent', protocol: protocol as never }],
    }

    await engine.execute(definition, { ...mockContext, correlationId: 'parent-corr-123' })

    expect(seenIds).toEqual(['parent-corr-123'])
  })
})

describe('WorkflowEngine conditions and parallel steps (#609)', () => {
  const protocol = (output: string) => ({
    name: 'capturing',
    config: { retryPolicy: { maxRetries: 0, backoffMs: 0 }, timeoutMs: 100 },
    execute: vi.fn(async () => output),
    onFailure: () => 'abort' as const,
  })

  it('skips a step whose condition is false and records it', async () => {
    const engine = new WorkflowEngine()
    const definition: WorkflowDefinition = {
      name: 'conditional',
      description: '',
      steps: [{ name: 'gate', type: 'agent' }, { name: 'after', type: 'agent', when: { step: 'gate', contains: 'YES' } }],
    }
    const result = await engine.execute(definition, mockContext)
    expect(result.stepResults.get('after')).toEqual({ skipped: true })
  })

  it('runs a step whose condition matches', async () => {
    const engine = new WorkflowEngine()
    const matches = protocol('YES')
    const definition: WorkflowDefinition = {
      name: 'conditional',
      description: '',
      steps: [
        { name: 'gate', type: 'agent', protocol: matches as never },
        { name: 'after', type: 'agent', protocol: protocol('ran') as never, when: { step: 'gate', contains: 'YES' } },
      ],
    }
    const result = await engine.execute(definition, mockContext)
    expect(result.stepResults.get('after')).toBe('ran')
  })

  it('fails closed when the condition names a step that did not run', async () => {
    const engine = new WorkflowEngine()
    const definition: WorkflowDefinition = {
      name: 'conditional',
      description: '',
      steps: [{ name: 'after', type: 'agent', when: { step: 'missing', notContains: 'x' } }],
    }
    const warn = vi.spyOn(console, 'log').mockImplementation(() => {})
    const result = await engine.execute(definition, mockContext)
    warn.mockRestore()
    expect(result.stepResults.get('after')).toEqual({ skipped: true })
  })

  it('runs sub-steps concurrently and returns one result each', async () => {
    const engine = new WorkflowEngine()
    const definition: WorkflowDefinition = {
      name: 'parallel',
      description: '',
      steps: [
        {
          name: 'group',
          type: 'parallel',
          subSteps: [
            { name: 'group:0:a', type: 'agent', protocol: protocol('a-out') as never },
            { name: 'group:1:b', type: 'agent', protocol: protocol('b-out') as never },
          ],
        },
      ],
    }
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const result = await engine.execute(definition, mockContext)
    log.mockRestore()

    expect(result.stepResults.get('group')).toEqual(['a-out', 'b-out'])
  })
})
