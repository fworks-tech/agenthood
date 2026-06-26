import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
    readFileSync: vi.fn(),
  }
})

import { existsSync, readdirSync } from 'node:fs'
import { ProjectMemoryImpl } from '../../../src/memory/ProjectMemory.js'
import { KnowledgeGraphStore } from '../../../src/rag/KnowledgeGraphStore.js'

describe('ProjectMemoryImpl', () => {
  beforeEach(() => {
    vi.mocked(existsSync).mockReset()
    vi.mocked(readdirSync).mockReset()
  })

  it('returns conventions from knowledge graph when available', async () => {
    const kg = new KnowledgeGraphStore()
    kg.addNode({ id: 'convention:COMMIT_CONVENTION.md', type: 'convention', label: 'COMMIT_CONVENTION.md', metadata: {} })
    const pm = new ProjectMemoryImpl('/test', kg)

    const conventions = await pm.getConventions()
    expect(conventions).toHaveLength(1)
    expect(conventions[0].type).toBe('convention')
  })

  it('falls back to filesystem when no knowledge graph', async () => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readdirSync).mockReturnValue(['COMMIT_CONVENTION.md', '.gitmessage'] as any)

    const pm = new ProjectMemoryImpl('/test')
    const conventions = await pm.getConventions()
    expect(conventions).toHaveLength(2)
    expect(conventions[0].label).toBe('COMMIT_CONVENTION.md')
  })

  it('returns ADRs from knowledge graph when available', async () => {
    const kg = new KnowledgeGraphStore()
    kg.addNode({ id: 'adr:ADR-010', type: 'adr', label: 'LanceDB', metadata: {} })
    const pm = new ProjectMemoryImpl('/test', kg)

    const adrs = await pm.getArchitecturalDecisions()
    expect(adrs).toHaveLength(1)
    expect(adrs[0].type).toBe('adr')
  })

  it('falls back to filesystem for ADRs when no knowledge graph', async () => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readdirSync).mockReturnValue(['ADR-010-lancedb.md', 'ADR-009-groq.md'] as any)

    const pm = new ProjectMemoryImpl('/test')
    const adrs = await pm.getArchitecturalDecisions()
    expect(adrs).toHaveLength(2)
    expect(adrs[0].label).toBe('ADR-010-lancedb')
  })

  it('returns empty array when conventions directory does not exist', async () => {
    vi.mocked(existsSync).mockReturnValue(false)
    const pm = new ProjectMemoryImpl('/test')
    const conventions = await pm.getConventions()
    expect(conventions).toEqual([])
  })

  it('returns empty array when ADR directory does not exist', async () => {
    vi.mocked(existsSync).mockReturnValue(false)
    const pm = new ProjectMemoryImpl('/test')
    const adrs = await pm.getArchitecturalDecisions()
    expect(adrs).toEqual([])
  })
})
