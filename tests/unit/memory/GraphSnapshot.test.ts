import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { GraphSnapshot } from '../../../src/memory/GraphSnapshot.js'
import { KnowledgeGraphStore } from '../../../src/rag/KnowledgeGraphStore.js'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'agenthood-snap-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function makeGraph(nodeId: string): KnowledgeGraphStore {
  const graph = new KnowledgeGraphStore()
  graph.addNode({ id: nodeId, type: 'adr', label: `ADR ${nodeId}` })
  return graph
}

describe('GraphSnapshot', () => {
  describe('take', () => {
    it('writes a timestamped snapshot file', () => {
      const snapshotter = new GraphSnapshot({ snapshotsDir: dir })
      const graph = makeGraph('adr-1')

      const path = snapshotter.take(graph)

      expect(existsSync(path)).toBe(true)
      expect(path).toContain('society-graph-')
      expect(path).toMatch(/society-graph-\d+\.json$/)
    })
  })

  describe('stateAt', () => {
    it('returns the latest snapshot at or before the target date', () => {
      const snapshotter = new GraphSnapshot({ snapshotsDir: dir })
      snapshotter.take(makeGraph('adr-early'))
      snapshotter.take(makeGraph('adr-late'))

      const graph = snapshotter.stateAt('2099-01-01T00:00:00.000Z')
      expect(graph).not.toBeNull()
      expect(graph!.stats().nodeCount).toBe(1)
      expect(graph!.getNode('adr-late').label).toBe('ADR adr-late')
    })

    it('returns null when no snapshot predates the target', () => {
      const snapshotter = new GraphSnapshot({ snapshotsDir: dir })
      snapshotter.take(makeGraph('adr-1'))

      const graph = snapshotter.stateAt('2000-01-01T00:00:00.000Z')
      expect(graph).toBeNull()
    })

    it('returns null when no snapshots exist', () => {
      const snapshotter = new GraphSnapshot({ snapshotsDir: join(dir, 'empty') })
      expect(snapshotter.stateAt('2099-01-01T00:00:00.000Z')).toBeNull()
    })
  })
})
