import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AgenticRAG } from '../../../src/rag/AgenticRAG.js'
import type { AgenticRetrievalResult, AgenticRAGOptions } from '../../../src/rag/AgenticRAG.js'
import { RetrievalClassifier } from '../../../src/skills/rag/RetrievalClassifier.js'
import type { ExecutionContext } from '../../../src/core/ExecutionContext.js'

function mockEmbedder() {
  return {
    complete: vi.fn(),
    stream: vi.fn(),
    embed: vi.fn().mockResolvedValue(Array(384).fill(0.1)),
    getContextWindow: vi.fn().mockReturnValue(128000),
    setModel: vi.fn(),
  }
}

function mockVectorStore() {
  return {
    add: vi.fn(),
    search: vi.fn().mockResolvedValue([
      { score: 0.95, record: { id: 'rec-1', content: 'Sample content', metadata: { source: 'test.md' }, createdAt: new Date() } },
      { score: 0.82, record: { id: 'rec-2', content: 'Other content', metadata: { source: 'other.md' }, createdAt: new Date() } },
    ]),
    delete: vi.fn(),
    clear: vi.fn(),
  }
}

function mockKGS() {
  return {
    addNode: vi.fn(),
    addEdge: vi.fn(),
    getNode: vi.fn().mockReturnValue({ id: 'node-1', label: 'TestNode', type: 'module', metadata: {} }),
    neighbors: vi.fn().mockReturnValue([{ node: { id: 'dep-1', label: 'Dependency', type: 'import', metadata: {} }, edge: { type: 'imports' } }]),
    pathBetween: vi.fn(),
    search: vi.fn().mockReturnValue([{ id: 'node-1', label: 'TestNode', type: 'module', metadata: {} }]),
    save: vi.fn(),
    load: vi.fn(),
    toJSON: vi.fn().mockReturnValue({}),
  }
}

function mockContext(): ExecutionContext {
  return {
    executionId: 'test',
    project: {} as ExecutionContext['project'],
    memory: {
      shortTerm: {
        add: vi.fn(),
        getRecent: vi.fn().mockReturnValue([]),
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

describe('AgenticRAG', () => {
  let embedder: ReturnType<typeof mockEmbedder>
  let vectorStore: ReturnType<typeof mockVectorStore>
  let kgs: ReturnType<typeof mockKGS>
  let ctx: ExecutionContext

  beforeEach(() => {
    embedder = mockEmbedder()
    vectorStore = mockVectorStore()
    kgs = mockKGS()
    ctx = mockContext()
  })

  it('executes vector strategy and returns provenance', async () => {
    const rag = new AgenticRAG({ embedder, vectorStore })
    const results = await rag.retrieve('explain how indexing works', ctx)

    expect(results.length).toBeGreaterThan(0)
    for (const r of results) {
      expect(r.strategy).toBe('vector')
      expect(r.vectorMatches).toBeGreaterThan(0)
    }
  })

  it('returns skip result when STM has answer', async () => {
    ctx.memory.shortTerm.getRecent = vi.fn().mockReturnValue(['BaseAgent explanation about what agents do'])
    const rag = new AgenticRAG({ embedder, vectorStore })
    const results = await rag.retrieve('what is BaseAgent', ctx)

    expect(results.length).toBe(1)
    expect(results[0].strategy).toBe('skip')
    expect(results[0].vectorMatches).toBe(0)
    expect(results[0].graphHops).toBe(0)
  })

  it('executes graph strategy with KGS', async () => {
    const rag = new AgenticRAG({ embedder, vectorStore, knowledgeGraphStore: kgs })
    const results = await rag.retrieve('what depends on Retriever', ctx)

    expect(results.length).toBeGreaterThan(0)
    const hasGraph = results.some((r) => r.strategy === 'graph' || r.strategy === 'both')
    expect(hasGraph).toBe(true)
  })

  it('executes both strategy for complex queries', async () => {
    const rag = new AgenticRAG({ embedder, vectorStore, knowledgeGraphStore: kgs })
    const results = await rag.retrieve('explain what depends on Retriever and how it works', ctx)

    expect(results.length).toBeGreaterThan(0)
    const hasBoth = results.some((r) => r.strategy === 'both')
    expect(hasBoth).toBe(true)
  })

  it('returns empty result with provenance for skip strategy', async () => {
    ctx.memory.shortTerm.getRecent = vi.fn().mockReturnValue(['already known'])
    const rag = new AgenticRAG({ embedder, vectorStore })
    const results = await rag.retrieve('already known', ctx)

    expect(results.length).toBe(1)
    expect(results[0].content).toBe('')
    expect(results[0].source).toBe('short-term-memory')
  })
})
