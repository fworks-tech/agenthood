import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  }
})

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { KnowledgeGraphStore } from '../../../src/rag/KnowledgeGraphStore.js'
import type { GraphNode, GraphEdge } from '../../../src/rag/KnowledgeGraphStore.js'

function makeNode(overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id: 'n1',
    type: 'file',
    label: 'VectorStore.ts',
    metadata: {},
    ...overrides,
  }
}

function makeEdge(overrides: Partial<GraphEdge> = {}): GraphEdge {
  return {
    id: 'e1',
    source: 'n1',
    target: 'n2',
    relation: 'imports',
    ...overrides,
  }
}

function fixtureGraph(): KnowledgeGraphStore {
  const g = new KnowledgeGraphStore()
  g.addNode({ id: 'a', type: 'adr', label: 'ADR-010', metadata: { status: 'accepted' } })
  g.addNode({ id: 'b', type: 'member', label: 'LanceDB', metadata: {} })
  g.addNode({ id: 'c', type: 'file', label: 'VectorStore.ts', metadata: { path: 'src/' } })
  g.addNode({ id: 'd', type: 'file', label: 'main.ts', metadata: {} })
  g.addEdge({ id: 'e1', source: 'a', target: 'b', relation: 'references' })
  g.addEdge({ id: 'e2', source: 'b', target: 'c', relation: 'implements' })
  g.addEdge({ id: 'e3', source: 'a', target: 'd', relation: 'references' })
  return g
}

describe('KnowledgeGraphStore', () => {
  beforeEach(() => {
    vi.mocked(existsSync).mockReturnValue(false)
    vi.mocked(readFileSync).mockReturnValue('{"nodes":[],"edges":[]}')
    vi.mocked(writeFileSync).mockReturnValue(undefined)
    vi.mocked(mkdirSync).mockReturnValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('addNode', () => {
    it('stores a node and retrieves it', () => {
      const g = new KnowledgeGraphStore()
      g.addNode(makeNode())
      expect(g.getNode('n1').id).toBe('n1')
    })

    it('throws when adding a duplicate id', () => {
      const g = new KnowledgeGraphStore()
      g.addNode(makeNode({ id: 'dup' }))
      expect(() => g.addNode(makeNode({ id: 'dup' }))).toThrow('already exists')
    })
  })

  describe('addEdge', () => {
    it('connects two nodes with an edge', () => {
      const g = fixtureGraph()
      const neighbors = g.neighbors('a')
      expect(neighbors).toHaveLength(2)
    })

    it('throws when source node does not exist', () => {
      const g = new KnowledgeGraphStore()
      g.addNode(makeNode({ id: 'n2' }))
      expect(() => g.addEdge(makeEdge({ source: 'nonexistent', target: 'n2' }))).toThrow('not found')
    })

    it('throws when target node does not exist', () => {
      const g = new KnowledgeGraphStore()
      g.addNode(makeNode({ id: 'n1' }))
      expect(() => g.addEdge(makeEdge({ source: 'n1', target: 'nonexistent' }))).toThrow('not found')
    })
  })

  describe('neighbors', () => {
    it('returns all neighbors when relation is omitted', () => {
      const g = fixtureGraph()
      const neighbors = g.neighbors('a')
      expect(neighbors).toHaveLength(2)
    })

    it('filters by relation type', () => {
      const g = fixtureGraph()
      const neighbors = g.neighbors('a', 'references')
      expect(neighbors).toHaveLength(2)
    })

    it('returns empty array when no edges match relation', () => {
      const g = fixtureGraph()
      const neighbors = g.neighbors('a', 'depends_on')
      expect(neighbors).toHaveLength(0)
    })

    it('returns empty array for non-existent node', () => {
      const g = new KnowledgeGraphStore()
      expect(g.neighbors('nonexistent')).toHaveLength(0)
    })
  })

  describe('pathBetween', () => {
    it('finds direct connection (1 edge)', () => {
      const g = fixtureGraph()
      const path = g.pathBetween('a', 'b')
      expect(path).toHaveLength(1)
      expect(path[0].id).toBe('b')
    })

    it('finds indirect path (multi-hop)', () => {
      const g = fixtureGraph()
      const path = g.pathBetween('a', 'c')
      expect(path).toHaveLength(2)
      expect(path[0].id).toBe('b')
      expect(path[1].id).toBe('c')
    })

    it('returns empty array when no path exists', () => {
      const g = fixtureGraph()
      g.addNode({ id: 'isolated', type: 'file', label: 'isolated.ts', metadata: {} })
      const path = g.pathBetween('a', 'isolated')
      expect(path).toHaveLength(0)
    })

    it('returns empty array for non-existent source', () => {
      const g = new KnowledgeGraphStore()
      expect(g.pathBetween('x', 'y')).toHaveLength(0)
    })
  })

  describe('search', () => {
    it('finds nodes by label substring match', () => {
      const g = fixtureGraph()
      const results = g.search('VectorStore')
      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('c')
    })

    it('is case-insensitive', () => {
      const g = fixtureGraph()
      const results = g.search('vectoRStore')
      expect(results).toHaveLength(1)
    })

    it('finds nodes by metadata value', () => {
      const g = fixtureGraph()
      const results = g.search('accepted')
      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('a')
    })

    it('returns empty array when no match', () => {
      const g = fixtureGraph()
      expect(g.search('zzznonexistent')).toHaveLength(0)
    })
  })

  describe('stats', () => {
    it('returns node and edge counts', () => {
      const g = fixtureGraph()
      const stats = g.stats()
      expect(stats.nodeCount).toBe(4)
      expect(stats.edgeCount).toBe(3)
    })

    it('returns zeros for empty graph', () => {
      const g = new KnowledgeGraphStore()
      expect(g.stats()).toEqual({ nodeCount: 0, edgeCount: 0 })
    })
  })

  describe('persistence', () => {
    it('saves graph to JSON file', () => {
      const g = fixtureGraph()
      g.save('/tmp/graph.json')
      expect(writeFileSync).toHaveBeenCalled()
      const written = JSON.parse(vi.mocked(writeFileSync).mock.calls[0][1] as string)
      expect(written.nodes).toHaveLength(4)
      expect(written.edges).toHaveLength(3)
    })

    it('loads graph from JSON file', () => {
      const payload = JSON.stringify({
        nodes: [
          { id: 'x', type: 'file', label: 'loaded.ts', metadata: {} },
          { id: 'y', type: 'file', label: 'other.ts', metadata: {} },
        ],
        edges: [{ id: 'ex', source: 'x', target: 'y', relation: 'imports' }],
      })
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue(payload)

      const g = new KnowledgeGraphStore()
      g.load('/tmp/graph.json')
      expect(g.stats().nodeCount).toBe(2)
      expect(g.stats().edgeCount).toBe(1)
    })

    it('starts empty when file does not exist', () => {
      vi.mocked(existsSync).mockReturnValue(false)

      const g = new KnowledgeGraphStore()
      g.load('/tmp/graph.json')
      expect(g.stats().nodeCount).toBe(0)
    })

    it('creates directory on save if missing', () => {
      const g = fixtureGraph()
      g.save('/new-dir/graph.json')
      expect(mkdirSync).toHaveBeenCalled()
      expect(writeFileSync).toHaveBeenCalled()
    })
  })
})
