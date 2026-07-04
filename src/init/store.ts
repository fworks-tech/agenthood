import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { LanceDBStore } from '../memory/VectorStore.js'
import { ResidualMemory } from '../memory/ResidualMemory.js'

export async function initVectorStore(cwd: string): Promise<void> {
  const memoryPath = join(cwd, '.agenthood', 'memory')
  const store = new LanceDBStore(1536)
  let lastErr: unknown
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await store.connect(memoryPath)
      return
    } catch (err) {
      lastErr = err
      if (attempt < 3) {
        console.warn(`[init] vector store connect attempt ${attempt} failed, retrying...`)
        await new Promise((r) => setTimeout(r, attempt * 500))
      }
    }
  }
  throw lastErr
}

export async function initResidualMemory(cwd: string): Promise<void> {
  const residualPath = join(cwd, '.agenthood', 'residual.json')
  if (existsSync(residualPath)) return
  const rm = new ResidualMemory()
  rm.save(residualPath)
}

export async function verifyTableReady(path: string): Promise<boolean> {
  try {
    const store = new LanceDBStore(1536)
    await store.connect(path)
    await store.stats()
    store.disconnect()
    return true
  } catch {
    return false
  }
}
