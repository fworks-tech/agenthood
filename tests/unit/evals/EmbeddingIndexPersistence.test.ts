import { describe, it, expect } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LanceDBStore } from '../../../src/memory/VectorStore.ts'
import { EmbeddingIndex } from '../../../src/evals/EmbeddingIndex.ts'

const integration = Boolean(process.env.AGENTHOOD_INTEGRATION)

/**
 * Exercises a real LanceDB table across process-boundary restarts. Skipped
 * unless AGENTHOOD_INTEGRATION=1 because CI keeps LanceDB fully mocked.
 */
describe.skipIf(!integration)('EmbeddingIndex persistence (real LanceDB)', () => {
  it('survives a disconnect/reconnect cycle', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'agenthood-index-'))

    const first = new LanceDBStore(1536)
    await first.connect(dir)
    const index = new EmbeddingIndex(first, 0.85)
    const vec = new Array(1536).fill(0)
    vec[0] = 0.5
    vec[1] = 0.5
    await index.storePattern('learned:dev:test:fixed flaky test', vec)
    const other = new Array(1536).fill(0)
    other[0] = 0.1
    other[1] = 0.1
    await index.storePattern('antipattern:dev:test:skipped tests silently', other)
    first.disconnect()

    const second = new LanceDBStore(1536)
    await second.connect(dir)
    const reopened = new EmbeddingIndex(second, 0.85)
    const matches = await reopened.findSimilar(vec)
    second.disconnect()
    rmSync(dir, { recursive: true, force: true })

    expect(matches.map((m) => m.pattern)).toContain('learned:dev:test:fixed flaky test')
  })

  it('upserts replace the previous row across restarts', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'agenthood-index-'))

    const first = new LanceDBStore(1536)
    await first.connect(dir)
    const vec = new Array(1536).fill(0)
    vec[0] = 0.9
    await new EmbeddingIndex(first).storePattern('p:same', vec)
    first.disconnect()

    const second = new LanceDBStore(1536)
    await second.connect(dir)
    const stats = await second.stats()
    second.disconnect()
    rmSync(dir, { recursive: true, force: true })

    expect(stats.totalVectors).toBe(1)
  })
})
