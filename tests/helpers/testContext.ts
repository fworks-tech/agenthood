import { randomUUID } from 'node:crypto'
import { vi } from 'vitest'
import type { ExecutionContext } from '../../src/core/ExecutionContext.ts'
import { ProvenanceStore } from '../../src/memory/ProvenanceStore.ts'
import { Tracer } from '../../src/core/Tracer.ts'
import { RedactionFilter } from '../../src/core/RedactionFilter.ts'
import { RunEventBus } from '../../src/core/RunEventBus.ts'

export function createTestContext(overrides?: Partial<ExecutionContext>): ExecutionContext {
  return {
    executionId: randomUUID(),
    project: {
      localPath: process.cwd(),
      name: 'test-project',
    },
    memory: {
      shortTerm: {
        add: () => {},
        getRecent: () => [],
        clear: () => {},
      },
      longTerm: {
        store: async () => {},
        retrieve: async () => null,
      },
      episodic: {
        record: async () => {},
        recall: async () => [],
        getEpisode: async () => ({ episode: 'mock episode', outcome: 'mock outcome', timestamp: new Date().toISOString() }),
      },
      project: {
        getConventions: async () => [],
        getArchitecturalDecisions: async () => [],
      },
      decisions: {
        record: async () => {},
        search: async () => [],
        recent: async () => [],
        get: async () => undefined,
        all: async () => [],
        addCausalRelationship: async () => {},
        traceDecisionChain: async () => [],
        analyzeDecisionImpact: async () => [],
      },
      provenance: {
        track: vi.fn(),
        get: vi.fn(),
        recent: vi.fn(),
        count: vi.fn(),
        invalidate: vi.fn(),
        verifyChain: vi.fn(),
      } as unknown as ProvenanceStore,
    },
    llm: {
      complete: async () => ({
        content: 'mock response',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        model: 'mock-model',
      }),
      stream: async () => { return async function* () {}() },
      embed: async () => [0],
      getContextWindow: () => 100000,
      setModel: () => {},
    },
    prompts: {
      build: () => ({ role: 'system' as const, content: 'mock prompt' }),
    },
    // disabled redactor matches production context shape while no-op'ing
    redactor: new RedactionFilter({ enabled: false }),
    tracer: new Tracer(),
    events: new RunEventBus(),
    artifacts: [],
    ...overrides,
  }
}
