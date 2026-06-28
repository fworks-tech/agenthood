import { randomUUID } from 'node:crypto'
import type { ExecutionContext } from '../../src/core/ExecutionContext.js'

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
    },
    llm: overrides?.llm ?? {
      complete: async () => ({
        content: 'mock response',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        model: 'mock-model',
      }),
      stream: async function* () {
        yield { delta: 'mock', done: false }
        yield { delta: '', done: true }
      },
      embed: async () => [0],
    },
    prompts: overrides?.prompts ?? {
      build: () => ({ role: 'system' as const, content: 'mock prompt' }),
    },
    tracer: overrides?.tracer ?? {
      startSpan: () => {},
      endSpan: () => {},
    },
    artifacts: [],
    ...overrides,
  }
}
