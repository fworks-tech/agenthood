import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { LanceDBStore } from '../memory/VectorStore.ts'
import { KnowledgeGraphStore } from '../rag/KnowledgeGraphStore.ts'
import { SkillDiscovery } from '../skills/discovery/SkillDiscovery.ts'
import type { ISkillManifest } from '../skills/discovery/ISkillManifest.ts'
import { defaultCatalogFormat, formatSkillCatalog, type CatalogFormat } from '../skills/catalog/format.ts'
import { gateSkills, type SkillAvailability, type GateResult } from '../skills/discovery/gating.ts'

export interface DiscoverSkillsOptions {
  provider?: string
  format?: CatalogFormat
  /** Skills disabled in config — filtered from the catalog (#537). */
  disabled?: string[]
  /** What this run offers; the gate decides which skills are usable (ADR-037). */
  availability?: SkillAvailability
}

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

export async function discoverSkills(
  projectPath: string,
  options: DiscoverSkillsOptions = {},
): Promise<{ catalog: string; manifests: Map<string, ISkillManifest> } & GateResult> {
  const discovery = new SkillDiscovery()
  const manifests = discovery.discover(projectPath)
  // Packaged tool skills merge at lowest precedence: a user/project skill
  // with the same name wins, so local overrides keep working.
  const seen = new Set(manifests.map((m) => m.name))
  for (const m of discovery.discoverPackaged()) {
    if (!seen.has(m.name)) {
      manifests.push(m)
      seen.add(m.name)
    }
  }

  // Every manifest stays activatable by name; the catalog is what gets filtered.
  const map = new Map(manifests.map((m) => [m.name, m] as const))
  // One gate decides what this run can use (ADR-037); a blocked skill is out of
  // the catalog here and refused by activate_skill with the same reason.
  const gate = gateSkills(manifests, options.availability)
  if (gate.blocked.size > 0) {
    console.log(`[skills] ${gate.blocked.size} skill(s) cannot run on this model: ${[...gate.blocked.keys()].join(', ')}`)
  }
  // An empty catalog would render as `<available_skills/>`, which invites the
  // model to invent skills — omit the whole section instead (#538).
  if (map.size === 0) return { catalog: '', manifests: new Map(), ...gate }

  const format = options.format ?? defaultCatalogFormat(options.provider)
  const body = formatSkillCatalog(
    manifests.filter((m) => !gate.blocked.has(m.name)),
    { format, disabled: new Set(options.disabled ?? []) },
  )
  if (!body) return { catalog: '', manifests: map, ...gate }

  const instruction =
    'When a task matches a skill\'s description, call the activate_skill tool with the skill\'s name to load its full instructions.'
  return { catalog: ['', body, '', instruction, ''].join('\n'), manifests: map, ...gate }
}
