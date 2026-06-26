import { describe, it, expect, vi } from 'vitest'
import { RetrievalClassifier } from '../../../src/skills/rag/RetrievalClassifier.js'
import type { ExecutionContext } from '../../../src/core/ExecutionContext.js'
import type { RetrievalStrategy } from '../../../src/skills/rag/RetrievalClassifier.js'

function mockContext(stmEntries: string[] = []): ExecutionContext {
  return {
    executionId: 'test',
    project: {} as ExecutionContext['project'],
    memory: {
      shortTerm: {
        add: vi.fn(),
        getRecent: vi.fn().mockReturnValue(stmEntries),
        clear: vi.fn(),
      },
      longTerm: {} as ExecutionContext['memory']['longTerm'],
      episodic: {} as ExecutionContext['memory']['episodic'],
      project: {} as ExecutionContext['memory']['project'],
    },
    llm: {} as ExecutionContext['llm'],
    prompts: { build: vi.fn() } as ExecutionContext['prompts'],
    tracer: {} as ExecutionContext['tracer'],
    artifacts: [],
  }
}

describe('RetrievalClassifier', () => {
  const classifier = new RetrievalClassifier()

  it('has the correct name and description', () => {
    expect(classifier.name).toBe('decide_retrieval')
    expect(classifier.description).toContain('retrieval')
  })

  it('returns skip when multiple words match ShortTermMemory', async () => {
    const ctx = mockContext(['what is BaseAgent and how does it work'])
    const result = await classifier.execute({ query: 'what is BaseAgent' }, ctx)

    expect(result.success).toBe(true)
    expect(result.output).toBe('skip')
  })

  it('does not skip when only one word matches STM', async () => {
    const ctx = mockContext(['Random unrelated text about indexing'])
    const result = await classifier.execute({ query: 'what is BaseAgent and how does it work' }, ctx)

    expect(result.output).not.toBe('skip')
  })

  it('returns graph for structural relationship queries', async () => {
    const ctx = mockContext()
    const result = await classifier.execute({ query: 'which functions call validate' }, ctx)

    expect(result.output).toBe('graph')
  })

  it('returns vector for semantic similarity queries', async () => {
    const ctx = mockContext()
    const result = await classifier.execute({ query: 'explain how the orchestrator works' }, ctx)

    expect(result.output).toBe('vector')
  })

  it('returns both for complex queries matching both patterns', async () => {
    const ctx = mockContext()
    const result = await classifier.execute({ query: 'explain what depends on the Retriever' }, ctx)

    expect(result.output).toBe('both')
  })

  it('returns vector by default for ambiguous queries', async () => {
    const ctx = mockContext()
    const result = await classifier.execute({ query: 'hello world' }, ctx)

    expect(result.output).toBe('vector')
  })

  it('requires minimum 2 word overlap for STM skip', async () => {
    const ctx = mockContext(['The Retriever class is in src/rag/Retriever.ts'])
    const result = await classifier.execute({ query: 'Retriever' }, ctx)

    expect(result.output).not.toBe('skip')
  })

  it('does not skip when STM is empty', async () => {
    const ctx = mockContext([])
    const result = await classifier.execute({ query: 'what is BaseAgent' }, ctx)

    expect(result.output).not.toBe('skip')
  })

  it('returns graph for keyword-based queries', async () => {
    const ctx = mockContext()
    const cases = [
      { query: 'which modules import auth', expected: 'graph' as RetrievalStrategy },
      { query: 'find functions that call validate', expected: 'graph' },
      { query: 'code that depends on the Retriever', expected: 'graph' },
    ]

    for (const c of cases) {
      const result = await classifier.execute({ query: c.query }, ctx)
      expect(result.output).toBe(c.expected)
    }
  })
})
