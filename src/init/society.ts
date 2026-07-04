import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SocietyIndexer } from '../project/SocietyIndexer.js'
import { KnowledgeGraphStore } from '../rag/KnowledgeGraphStore.js'
import { LanceDBStore } from '../memory/VectorStore.js'
import type { ILLMProvider } from '../llm/ILLMProvider.js'
import { LLMRouter } from '../llm/LLMRouter.js'
import type { LLMConfig } from '../llm/types.js'

export async function indexSociety(cwd: string): Promise<void> {
  const societyRoot = join(cwd, 'node_modules', 'agenthood')
  const __dirname = dirname(fileURLToPath(import.meta.url))
  const sourceRoot = existsSync(societyRoot) ? societyRoot : __dirname
  const basePath = join(sourceRoot, '..', '..')

  const kg = new KnowledgeGraphStore()

  const vectorStore = new LanceDBStore(1536)
  const memoryPath = join(cwd, '.agenthood', 'memory')
  if (existsSync(memoryPath)) {
    try { await vectorStore.connect(memoryPath) } catch { console.warn('[init] vector store unavailable for seeding') }
  }

  let embedder: ILLMProvider | undefined
  try {
    const configPath = join(cwd, '.agenthood', 'config.json')
    if (existsSync(configPath)) {
      embedder = await LLMRouter.create(JSON.parse(readFileSync(configPath, 'utf8')) as LLMConfig)
    }
  } catch { console.warn('[init] embedder not available — skipping vector seeding') }

  const indexer = new SocietyIndexer({
    basePath,
    knowledgeGraph: kg,
    vectorStore,
    embedder,
  })

  await indexer.index()
  kg.save(join(cwd, '.agenthood', 'society-graph.json'))
}
