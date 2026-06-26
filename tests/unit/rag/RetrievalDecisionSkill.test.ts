import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RetrievalDecisionSkill } from '../../../src/skills/rag/RetrievalDecisionSkill.js'
import type { ExecutionContext } from '../../../src/core/ExecutionContext.js'
import type { RetrievalStrategy } from '../../../src/skills/rag/RetrievalDecisionSkill.js'

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

describe('RetrievalDecisionSkill', () => {
  const skill = new RetrievalDecisionSkill()

  it('has the correct name and description', () => {
    expect(skill.name).toBe('decide_retrieval')
    expect(skill.description).toContain('retrieve')
  })

  it('returns skip when answerable from ShortTermMemory', async () => {
    const ctx = mockContext(['BaseAgent extends the Agent class and uses ReActLoop'])
    const result = await skill.execute({ query: 'what is BaseAgent' }, ctx)

    expect(result.success).toBe(true)
    expect(result.output).toBe('skip')
  })

  it('returns graph for structural relationship queries', async () => {
    const ctx = mockContext()
    const result = await skill.execute({ query: 'which functions call validate' }, ctx)

    expect(result.output).toBe('graph')
  })

  it('returns vector for semantic similarity queries', async () => {
    const ctx = mockContext()
    const result = await skill.execute({ query: 'explain how the orchestrator works' }, ctx)

    expect(result.output).toBe('vector')
  })

  it('returns both for complex queries matching both patterns', async () => {
    const ctx = mockContext()
    const result = await skill.execute({ query: 'explain what depends on the Retriever' }, ctx)

    expect(result.output).toBe('both')
  })

  it('returns vector by default for ambiguous queries', async () => {
    const ctx = mockContext()
    const result = await skill.execute({ query: 'hello world' }, ctx)

    expect(result.output).toBe('vector')
  })

  it('returns skip when STM contains exact query match', async () => {
    const ctx = mockContext(['The Retriever class is in src/rag/Retriever.ts'])
    const result = await skill.execute({ query: 'Retriever' }, ctx)

    expect(result.output).toBe('skip')
  })

  it('does not skip when STM is empty', async () => {
    const ctx = mockContext([])
    const result = await skill.execute({ query: 'what is BaseAgent' }, ctx)

    expect(result.output).not.toBe('skip')
  })

  it('returns graph for calls/uses keywords', async () => {
    const ctx = mockContext()
    const cases = [
      { query: 'which modules import auth', expected: 'graph' as RetrievalStrategy },
      { query: 'find functions that call validate', expected: 'graph' },
      { query: 'code that depends on the Retriever', expected: 'graph' },
    ]

    for (const c of cases) {
      const result = await skill.execute({ query: c.query }, ctx)
      expect(result.output).toBe(c.expected)
    }
  })
})
