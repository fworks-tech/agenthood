import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const vectorStoreMock = vi.hoisted(() => {
  const mockAdd = vi.fn()
  const mockQuery = vi.fn()
  const mockVectorSearch = vi.fn()
  const mockDelete = vi.fn()
  const mockCountRows = vi.fn()
  const mockOpenTable = vi.fn()
  const mockCreateEmptyTable = vi.fn()

  class MockVectorQuery {
    private _limit = 0
    private _filter = ''
    limit(n: number) {
      this._limit = n
      return this
    }
    filter(f: string) {
      this._filter = f
      return this
    }
    toArray() {
      return mockVectorSearch(this._limit, this._filter)
    }
  }

  class MockQuery {
    private _limit = 0
    private _filter = ''
    private _orderBy: unknown = null
    limit(n: number) {
      this._limit = n
      return this
    }
    filter(f: string) {
      this._filter = f
      return this
    }
    orderBy(ordering: unknown) {
      this._orderBy = ordering
      return this
    }
    toArray() {
      return mockQuery(this._limit, this._filter, this._orderBy)
    }
  }

  return {
    mockAdd,
    mockQuery,
    mockVectorSearch,
    mockDelete,
    mockCountRows,
    mockOpenTable,
    mockCreateEmptyTable,
    MockTable: class MockTable {
      add = mockAdd
      delete = mockDelete
      countRows = mockCountRows
      vectorSearch(_vec: Float32Array) {
        return new MockVectorQuery()
      }
      query() {
        return new MockQuery()
      }
    },
  }
})

vi.mock('@lancedb/lancedb', () => ({
  connect: vi.fn().mockResolvedValue({
    openTable: vectorStoreMock.mockOpenTable,
    createEmptyTable: vectorStoreMock.mockCreateEmptyTable,
  }),
}))

vi.mock('../../../src/llm/LLMRouter.ts', () => ({
  LLMRouter: {
    create: vi.fn(),
    createForMember: vi.fn(),
    knownProviders: vi.fn(),
  },
}))

import { ApplicationContext } from '../../../src/runtime/ApplicationContext.ts'
import { LLMRouter } from '../../../src/llm/LLMRouter.ts'

function fakeProvider(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    complete: vi.fn().mockResolvedValue({
      content: 'mock member output',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      model: 'mock-model',
    }),
    stream: vi.fn(),
    embed: vi.fn().mockResolvedValue([0]),
    setModel: vi.fn(),
    generate: vi.fn(),
    getContextWindow: vi.fn().mockReturnValue(8192),
    ...overrides,
  }
}

describe('ApplicationContext run pipeline', () => {
  let projectDir: string
  const originalCwd = process.cwd()

  beforeAll(async () => {
    projectDir = mkdtempSync(join(tmpdir(), 'agenthood-appctx-'))
    process.chdir(projectDir)
    vectorStoreMock.mockOpenTable.mockResolvedValue(new vectorStoreMock.MockTable())
    vectorStoreMock.mockQuery.mockResolvedValue([])
    vectorStoreMock.mockAdd.mockResolvedValue(undefined)
    vectorStoreMock.mockCountRows.mockResolvedValue(0)
    vi.mocked(LLMRouter.create).mockResolvedValue(fakeProvider() as never)
    vi.mocked(LLMRouter.createForMember).mockResolvedValue(fakeProvider() as never)
  })

  afterAll(() => {
    process.chdir(originalCwd)
    rmSync(projectDir, { recursive: true, force: true })
  })

  it('runs a core agent end-to-end, emitting and flushing a trace', async () => {
    const app = await ApplicationContext.create(projectDir, {} as never)

    await app.runAgent('developer', 'implement login')

    expect(app.ctx.tracer.getRecent(1)[0].member).toBe('developer')
    expect(app.ctx.tracer.getRecent(1)[0].status).toBe('success')

    const tracesPath = join(projectDir, '.agenthood', 'traces', 'traces.ndjson')
    expect(existsSync(tracesPath)).toBe(true)
    const lines = readFileSync(tracesPath, 'utf8').trim().split('\n').filter(Boolean)
    expect(lines).toHaveLength(1)
    expect(JSON.parse(lines[0]).member).toBe('developer')
  })

  it('flushes an error-status trace when a member run fails', async () => {
    vi.mocked(LLMRouter.createForMember).mockResolvedValue(
      fakeProvider({
        complete: vi.fn().mockRejectedValue(new Error('provider exploded')),
      }) as never,
    )
    const app = await ApplicationContext.create(projectDir, {} as never)

    await expect(app.runMemberTask('the-builder', 'write a test', {} as never)).rejects.toThrow('provider exploded')

    const env = app.ctx.tracer.getRecent(1)[0]
    expect(env.member).toBe('the-builder')
    expect(env.status).toBe('error')
  })

  it('succeeds when the LLM reports usage and stamps source from the context', async () => {
    vi.mocked(LLMRouter.create).mockResolvedValue(fakeProvider() as never)
    vi.mocked(LLMRouter.createForMember).mockResolvedValue(fakeProvider() as never)
    const app = await ApplicationContext.create(projectDir, {} as never)
    app.ctx.source = 'cli'

    await app.runMemberTask('the-builder', 'write a test', {} as never)

    const env = app.ctx.tracer.getRecent(1)[0]
    expect(env.source).toBe('cli')
    expect(env.tokenCount).toEqual({ input: 10, output: 5, total: 15 })
    expect(env.cost).toBeGreaterThanOrEqual(0)
  })
})
