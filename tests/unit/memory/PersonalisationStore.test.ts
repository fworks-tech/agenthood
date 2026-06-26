import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockExistsSync = vi.fn()
const mockReadFileSync = vi.fn()

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  }
})

describe('PersonalisationStore', () => {
  let PersonalisationStore: typeof import('../../../src/memory/PersonalisationStore.js').PersonalisationStore

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/memory/PersonalisationStore.js')
    PersonalisationStore = mod.PersonalisationStore
  })

  it('sets and gets a preference', () => {
    const store = new PersonalisationStore()
    store.set('style', 'concise', 'explicit')
    expect(store.get('style')?.value).toBe('concise')
  })

  it('overwrites an existing preference', () => {
    const store = new PersonalisationStore()
    store.set('style', 'concise', 'explicit')
    store.set('style', 'verbose', 'explicit')
    expect(store.get('style')?.value).toBe('verbose')
  })

  it('returns all preferences', () => {
    const store = new PersonalisationStore()
    store.set('style', 'concise', 'explicit')
    store.set('depth', 'high', 'explicit')
    const all = store.getAll()
    expect(all).toHaveLength(2)
  })

  it('formats preferences as prompt context', () => {
    const store = new PersonalisationStore()
    store.set('style', 'concise', 'explicit')
    const ctx = store.toPromptContext()
    expect(ctx).toContain('style')
    expect(ctx).toContain('concise')
    expect(ctx).toContain('explicit')
  })

  it('returns empty string when no preferences set', () => {
    const store = new PersonalisationStore()
    expect(store.toPromptContext()).toBe('')
  })

  it('persists to and loads from file', () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue(JSON.stringify({
      preferences: [
        { key: 'style', value: 'concise', source: 'explicit', confirmedAt: '2025-01-01T00:00:00.000Z' },
      ],
    }))

    const store = new PersonalisationStore('/tmp/prefs.json')
    expect(store.get('style')?.value).toBe('concise')
  })

  it('infers preferences from residual memory signals', () => {
    const mockResidualMemory = {
      getActive: vi.fn().mockReturnValue([
        { id: '1', pattern: 'prefer concise style', strength: 0.85, lastReinforced: new Date(), decayRate: 0.9 },
      ]),
    } as any

    const store = new PersonalisationStore()
    store.inferFromResidualMemory(mockResidualMemory)
    expect(store.get('style')?.value).toBe('concise')
    expect(store.get('style')?.source).toBe('inferred')
  })

  it('does not overwrite explicit preferences with inferred ones', () => {
    const mockResidualMemory = {
      getActive: vi.fn().mockReturnValue([
        { id: '1', pattern: 'prefer concise style', strength: 0.85, lastReinforced: new Date(), decayRate: 0.9 },
      ]),
    } as any

    const store = new PersonalisationStore()
    store.set('style', 'verbose', 'explicit')
    store.inferFromResidualMemory(mockResidualMemory)
    expect(store.get('style')?.value).toBe('verbose')
    expect(store.get('style')?.source).toBe('explicit')
  })

  it('clears all preferences', () => {
    const store = new PersonalisationStore()
    store.set('style', 'concise', 'explicit')
    store.clear()
    expect(store.getAll()).toHaveLength(0)
  })

  it('loads existing preferences from file on construction', () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue(JSON.stringify({
      preferences: [
        { key: 'domain', value: 'web', source: 'explicit', confirmedAt: '2025-01-01T00:00:00.000Z' },
      ],
    }))

    const store = new PersonalisationStore('/tmp/prefs.json')
    expect(store.get('domain')?.value).toBe('web')
  })
})
