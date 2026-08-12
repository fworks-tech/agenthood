import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { KnowledgeGraphStore } from '../rag/KnowledgeGraphStore.js'

export interface GraphSnapshotOptions {
  snapshotsDir?: string
}

const FILE_PREFIX = 'society-graph-'

function snapshotFileName(date: Date): string {
  return `${FILE_PREFIX}${date.getTime()}.json`
}

export class GraphSnapshot {
  private snapshotsDir: string

  constructor(options: GraphSnapshotOptions = {}) {
    this.snapshotsDir = options.snapshotsDir ?? join(process.cwd(), '.agenthood', 'snapshots')
  }

  take(graph: KnowledgeGraphStore): string {
    if (!existsSync(this.snapshotsDir)) {
      mkdirSync(this.snapshotsDir, { recursive: true })
    }
    const filePath = join(this.snapshotsDir, snapshotFileName(new Date()))
    graph.save(filePath)
    return filePath
  }

  stateAt(date: string): KnowledgeGraphStore | null {
    if (!existsSync(this.snapshotsDir)) return null
    const target = new Date(date).getTime()

    let best: { path: string; time: number } | null = null
    for (const file of readdirSync(this.snapshotsDir)) {
      if (!file.startsWith(FILE_PREFIX) || !file.endsWith('.json')) continue
      const time = Number(file.slice(FILE_PREFIX.length, -'.json'.length))
      if (!Number.isFinite(time)) continue
      if (time <= target && (!best || time > best.time)) {
        best = { path: join(this.snapshotsDir, file), time }
      }
    }

    if (!best) return null
    const graph = new KnowledgeGraphStore()
    graph.load(best.path)
    return graph
  }
}
