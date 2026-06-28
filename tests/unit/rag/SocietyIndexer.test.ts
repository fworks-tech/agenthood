import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFiles: Record<string, string> = {
  'members/the-scribe/SKILL.md': '# The Scribe\nWrites commit messages.',
  'members/the-architect/SKILL.md': '# The Architect\nPlans implementations.',
  'docs/adr/ADR-008-typescript-runtime.md': '# ADR-008: TypeScript Runtime\n\nSupersedes: ADR-006, ADR-007\n\nDecision: Use TypeScript.',
  'docs/adr/ADR-009-groq-provider.md': '# ADR-009: Groq Provider\n\nDecision: Use Groq. See ADR-008.',
  'docs/adr/ADR-006-python-runtime.md': '# ADR-006: Python Runtime\n\nSuperseded by ADR-008.',
  'conventions/COMMIT_CONVENTION.md': '# Commit Convention\nfeat: new feature\nfix: bug fix',
  'conventions/.gitmessage': '# subject\n\n# body',
}

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    existsSync: vi.fn().mockImplementation((path: string) => {
      if (typeof path !== 'string') return false
      const normalPath = path.replace(/\\/g, '/')
      if (normalPath.startsWith('/base/') || normalPath === '/base') return true
      const relPath = normalPath.replace(/^.*?\/base\//, '')
      return relPath in mockFiles
    }),
    readdirSync: vi.fn().mockImplementation((path: string, options?: { withFileTypes?: boolean }) => {
      const relPath = path.replace(/\\/g, '/').replace(/^.*?\/base\//, '').replace(/\/$/, '')
      if (relPath === 'members') {
        const names = ['the-scribe', 'the-architect']
        if (options?.withFileTypes) {
          return names.map((name) => ({ name, isDirectory: () => true, isFile: () => false }))
        }
        return names
      }
      if (relPath === 'docs/adr') return ['ADR-008-typescript-runtime.md', 'ADR-009-groq-provider.md', 'ADR-006-python-runtime.md']
      if (relPath === 'conventions') return ['COMMIT_CONVENTION.md', '.gitmessage']
      return []
    }),
    readFileSync: vi.fn().mockImplementation((path: string) => {
      if (typeof path !== 'string') throw new Error('not found')
      const relPath = path.replace(/\\/g, '/').replace(/^.*?\/base\//, '').replace(/\/$/, '')
      const content = mockFiles[relPath]
      if (content !== undefined) return content
      throw new Error(`not found: ${relPath}`)
    }),
  }
})

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { SocietyIndexer } from '../../../src/project/SocietyIndexer.js'
import { KnowledgeGraphStore } from '../../../src/rag/KnowledgeGraphStore.js'
import type { ILLMProvider } from '../../../src/llm/ILLMProvider.js'
import type { IVectorStore } from '../../../src/memory/VectorStore.js'

describe('SocietyIndexer', () => {
  let knowledgeGraph: KnowledgeGraphStore
  let indexer: SocietyIndexer

  beforeEach(() => {
    vi.clearAllMocks()
    knowledgeGraph = new KnowledgeGraphStore()
    indexer = new SocietyIndexer({
      basePath: '/base',
      knowledgeGraph,
    })
  })

  it('indexes all members as member nodes', async () => {
    await indexer.index({ entities: ['member'] })
    const nodes = knowledgeGraph.search('')
    const members = nodes.filter((n) => n.type === 'member')
    expect(members.length).toBe(2)
    expect(members.some((m) => m.label === 'the-scribe')).toBe(true)
    expect(members.some((m) => m.label === 'the-architect')).toBe(true)
  })

  it('indexes ADRs and creates supersedes edges', async () => {
    await indexer.index({ entities: ['adr'] })

    const adr008 = knowledgeGraph.getNode('adr:ADR-008-typescript-runtime')
    expect(adr008.type).toBe('adr')

    const neighbors = knowledgeGraph.neighbors('adr:ADR-008-typescript-runtime')
    expect(neighbors.some((n) => n.edge.relation === 'supersedes')).toBe(true)
  })

  it('indexes convention files', async () => {
    await indexer.index({ entities: ['convention'] })
    const nodes = knowledgeGraph.search('Commit Convention')
    expect(nodes.length).toBeGreaterThanOrEqual(1)
  })

  it('indexes all entities by default', async () => {
    await indexer.index()
    const stats = indexer.stats()
    expect(stats.nodeCount).toBe(7)
    expect(stats.edgeCount).toBeGreaterThanOrEqual(1)
  })

  it('optionally embeds content into VectorStore', async () => {
    const mockEmbedder = {
      embed: vi.fn().mockResolvedValue(new Array(128).fill(0.1)),
    } as unknown as ILLMProvider
    const mockVectorStore = {
      add: vi.fn().mockResolvedValue(undefined),
      search: vi.fn(),
      connect: vi.fn(),
      delete: vi.fn(),
      stats: vi.fn(),
    } as unknown as IVectorStore

    const vsIndexer = new SocietyIndexer({
      basePath: '/base',
      knowledgeGraph,
      vectorStore: mockVectorStore,
      embedder: mockEmbedder,
    })

    await vsIndexer.index({ entities: ['member'] })

    await vi.waitFor(() => {
      expect(mockEmbedder.embed).toHaveBeenCalled()
      expect(mockVectorStore.add).toHaveBeenCalled()
    }, { timeout: 2000 })
  })
})
