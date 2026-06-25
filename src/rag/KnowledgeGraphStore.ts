import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export interface GraphNode {
  id: string
  type: 'member' | 'skill' | 'adr' | 'file' | 'function' | 'class'
  label: string
  metadata?: Record<string, unknown>
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  relation: string
  weight?: number
}

export interface NeighborResult {
  node: GraphNode
  edge: GraphEdge
}

export interface IGraphStore {
  addNode(node: GraphNode): void
  addEdge(edge: GraphEdge): void
  getNode(nodeId: string): GraphNode
  neighbors(nodeId: string, relation?: string): NeighborResult[]
  pathBetween(fromId: string, toId: string): GraphNode[]
  search(query: string): GraphNode[]
  stats(): { nodeCount: number; edgeCount: number }
  save(filePath: string): void
  load(filePath: string): void
}

export class KnowledgeGraphStore implements IGraphStore {
  private nodes: Map<string, GraphNode> = new Map()
  private edges: GraphEdge[] = []
  private adjacency: Map<string, Array<{ edge: GraphEdge; targetId: string }>> = new Map()

  addNode(node: GraphNode): void {
    if (this.nodes.has(node.id)) {
      throw new Error(`KnowledgeGraphStore: node "${node.id}" already exists`)
    }
    this.nodes.set(node.id, node)
    this.adjacency.set(node.id, [])
  }

  addEdge(edge: GraphEdge): void {
    if (!this.nodes.has(edge.source)) {
      throw new Error(`KnowledgeGraphStore: source node "${edge.source}" not found`)
    }
    if (!this.nodes.has(edge.target)) {
      throw new Error(`KnowledgeGraphStore: target node "${edge.target}" not found`)
    }
    this.edges.push(edge)
    this.adjacency.get(edge.source)!.push({ edge, targetId: edge.target })
    this.adjacency.get(edge.target)!.push({ edge, targetId: edge.source })
  }

  getNode(nodeId: string): GraphNode {
    const node = this.nodes.get(nodeId)
    if (!node) {
      throw new Error(`KnowledgeGraphStore: node "${nodeId}" not found`)
    }
    return node
  }

  neighbors(nodeId: string, relation?: string): NeighborResult[] {
    const adj = this.adjacency.get(nodeId)
    if (!adj) return []

    const results: NeighborResult[] = []
    const seen = new Set<string>()
    for (const { edge, targetId } of adj) {
      if (relation && edge.relation !== relation) continue
      const targetNode = this.nodes.get(targetId)
      if (targetNode && !seen.has(targetId)) {
        results.push({ node: targetNode, edge })
        seen.add(targetId)
      }
    }
    return results
  }

  pathBetween(fromId: string, toId: string): GraphNode[] {
    if (!this.nodes.has(fromId) || !this.nodes.has(toId)) return []

    const visited = new Set<string>()
    const queue: Array<{ nodeId: string; path: string[] }> = [{ nodeId: fromId, path: [fromId] }]

    while (queue.length > 0) {
      const { nodeId, path } = queue.shift()!
      if (nodeId === toId) {
        return path.slice(1).map((id) => this.nodes.get(id)!)
      }
      if (visited.has(nodeId)) continue
      visited.add(nodeId)

      const adj = this.adjacency.get(nodeId)
      if (adj) {
        for (const { targetId } of adj) {
          if (!visited.has(targetId)) {
            queue.push({ nodeId: targetId, path: [...path, targetId] })
          }
        }
      }
    }
    return []
  }

  search(query: string): GraphNode[] {
    const lower = query.toLowerCase()
    const results: GraphNode[] = []
    for (const node of this.nodes.values()) {
      if (node.label.toLowerCase().includes(lower)) {
        results.push(node)
        continue
      }
      if (node.metadata) {
        for (const val of Object.values(node.metadata)) {
          if (String(val).toLowerCase().includes(lower)) {
            results.push(node)
            break
          }
        }
      }
    }
    return results
  }

  stats(): { nodeCount: number; edgeCount: number } {
    return { nodeCount: this.nodes.size, edgeCount: this.edges.length }
  }

  save(filePath: string): void {
    const dir = dirname(filePath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    writeFileSync(
      filePath,
      JSON.stringify(
        { nodes: Array.from(this.nodes.values()), edges: this.edges },
        null,
        2,
      ),
      'utf8',
    )
  }

  load(filePath: string): void {
    if (!existsSync(filePath)) return
    const raw = readFileSync(filePath, 'utf8')
    const data: { nodes: GraphNode[]; edges: GraphEdge[] } = JSON.parse(raw)
    this.nodes.clear()
    this.edges = []
    this.adjacency.clear()
    for (const node of data.nodes) {
      this.nodes.set(node.id, node)
      this.adjacency.set(node.id, [])
    }
    for (const edge of data.edges) {
      this.edges.push(edge)
      this.adjacency.get(edge.source)?.push({ edge, targetId: edge.target })
      this.adjacency.get(edge.target)?.push({ edge, targetId: edge.source })
    }
  }
}
