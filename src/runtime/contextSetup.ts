import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { LanceDBStore } from '../memory/VectorStore.ts'
import { KnowledgeGraphStore } from '../rag/KnowledgeGraphStore.ts'
import { SkillDiscovery } from '../skills/discovery/SkillDiscovery.ts'
import type { ISkillManifest } from '../skills/discovery/ISkillManifest.ts'
import { escapeXml } from '../agents/memberLore.ts'

export async function connectVectorStore(projectPath: string): Promise<LanceDBStore> {
  const vectorStore = new LanceDBStore(1536)
  const memoryPath = join(projectPath, '.agenthood', 'memory')
  try {
    await vectorStore.connect(memoryPath)
  } catch (e) {
    console.warn(`[run] vector store unavailable: ${(e as Error)?.message ?? e}`)
  }
  return vectorStore
}

export function loadSocietyGraph(projectPath: string): KnowledgeGraphStore {
  const graph = new KnowledgeGraphStore()
  const graphPath = join(projectPath, '.agenthood', 'society-graph.json')
  if (existsSync(graphPath)) {
    try {
      graph.load(graphPath)
    } catch (e) {
      console.warn(`[run] society graph unavailable: ${(e as Error)?.message ?? e}`)
    }
  }
  return graph
}

export async function discoverSkills(projectPath: string): Promise<{ catalog: string; manifests: Map<string, ISkillManifest> }> {
  const discovery = new SkillDiscovery()
  const manifests = discovery.discover(projectPath)
  if (manifests.length === 0) return { catalog: '', manifests: new Map() }

  const lines: string[] = ['', '<available_skills>']
  const map = new Map<string, ISkillManifest>()
  for (const m of manifests) {
    map.set(m.name, m)
    lines.push(`  <skill name="${escapeXml(m.name)}">`)
    lines.push(`    <description>${escapeXml(m.description)}</description>`)
    lines.push(`    <location>${escapeXml(m.location)}</location>`)
    lines.push('  </skill>')
  }
  lines.push('</available_skills>')
  lines.push('')
  lines.push('When a task matches a skill\'s description, call the activate_skill tool with the skill\'s name to load its full instructions.')
  lines.push('')

  return { catalog: lines.join('\n'), manifests: map }
}
