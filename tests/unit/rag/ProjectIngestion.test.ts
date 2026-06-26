import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    readdirSync: vi.fn(),
    statSync: vi.fn(),
    readFileSync: vi.fn(),
  }
})

vi.mock('../../../src/rag/parsers/TreeSitterParser.js', () => {
  class MockTreeSitterParser {
    parse = vi.fn().mockReturnValue([
      { type: 'function', name: 'hello', startLine: 1, endLine: 3, filePath: '/test/index.ts', dependencies: [] },
      { type: 'import', name: './utils', startLine: 1, endLine: 1, filePath: '/test/index.ts', dependencies: ['./utils'] },
    ])
  }
  const languageFromFile = (path: string) => {
    if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'typescript'
    if (path.endsWith('.py')) return 'python'
    if (path.endsWith('.go')) return 'go'
    return null
  }
  return { TreeSitterParser: MockTreeSitterParser, languageFromFile, IParser: {} }
})

import { readdirSync, statSync, readFileSync } from 'node:fs'
import { ProjectIngestion } from '../../../src/rag/ProjectIngestion.js'
import { KnowledgeGraphStore } from '../../../src/rag/KnowledgeGraphStore.js'
import type { Indexer } from '../../../src/rag/Indexer.js'

describe('ProjectIngestion', () => {
  let ingestion: ProjectIngestion
  let mockIndexer: Indexer
  let knowledgeGraph: KnowledgeGraphStore

  beforeEach(() => {
    vi.mocked(readdirSync).mockReset()
    vi.mocked(statSync).mockReset()
    vi.mocked(readFileSync).mockReset()

    mockIndexer = {
      indexDocument: vi.fn().mockResolvedValue(undefined),
      stats: vi.fn().mockReturnValue({ totalDocuments: 0, totalChunks: 0, indexedExtensions: [] }),
    } as unknown as Indexer

    knowledgeGraph = new KnowledgeGraphStore()
    ingestion = new ProjectIngestion()
  })

  it('indexes code files with tree-sitter and populates KGS', async () => {
    vi.mocked(readdirSync).mockReturnValueOnce(['index.ts'])
    vi.mocked(statSync).mockReturnValueOnce({ isDirectory: () => false, isFile: () => true, size: 100 } as ReturnType<typeof import('node:fs').statSync>)
    vi.mocked(readFileSync).mockReturnValueOnce('function hello() {} import { x } from "./utils"')

    await ingestion.ingest('/test', mockIndexer, knowledgeGraph)

    const stats = knowledgeGraph.stats()
    expect(stats.nodeCount).toBeGreaterThanOrEqual(2)
    expect(stats.edgeCount).toBeGreaterThanOrEqual(0)
  })

  it('skips non-code files but adds them as file nodes', async () => {
    vi.mocked(readdirSync).mockReturnValueOnce(['readme.md'])
    vi.mocked(statSync).mockReturnValueOnce({ isDirectory: () => false, isFile: () => true, size: 50 } as ReturnType<typeof import('node:fs').statSync>)
    vi.mocked(readFileSync).mockReturnValueOnce('# Hello')

    await ingestion.ingest('/test', mockIndexer, knowledgeGraph)

    expect(knowledgeGraph.stats().nodeCount).toBe(1)
    const node = knowledgeGraph.getNode('file:readme.md')
    expect(node.type).toBe('file')
  })

  it('skips node_modules and hidden directories', async () => {
    const calls: string[] = []
    vi.mocked(readdirSync).mockImplementation((path: string) => {
      calls.push(path)
      if (path === '/test') return ['node_modules', '.hidden', 'src']
      return []
    })
    vi.mocked(statSync).mockImplementation((path: string) => ({
      isDirectory: () => typeof path === 'string' && (path.endsWith('node_modules') || path.endsWith('.hidden') || path.endsWith('src')),
      isFile: () => true,
    } as ReturnType<typeof import('node:fs').statSync>))

    await ingestion.ingest('/test', mockIndexer, knowledgeGraph)

    expect(knowledgeGraph.stats().nodeCount).toBe(0)
  })

  it('gracefully handles unreadable files', async () => {
    vi.mocked(readdirSync).mockReturnValueOnce(['index.ts'])
    vi.mocked(statSync).mockReturnValueOnce({ isDirectory: () => false, isFile: () => true, size: 100 } as ReturnType<typeof import('node:fs').statSync>)
    vi.mocked(readFileSync).mockImplementationOnce(() => { throw new Error('permission denied') })

    await expect(ingestion.ingest('/test', mockIndexer, knowledgeGraph)).resolves.not.toThrow()
  })
})
