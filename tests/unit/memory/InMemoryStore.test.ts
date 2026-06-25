import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { InMemoryStore } from '../../../src/memory/stores/InMemoryStore.js'

describe('InMemoryStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000_000_000)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('stores a value and retrieves it', async () => {
    const store = new InMemoryStore<string>({ maxSize: 100, pruneStrategy: 'hybrid' })
    await store.set('key1', 'value1')
    expect(await store.get('key1')).toBe('value1')
  })

  it('returns undefined for missing key', async () => {
    const store = new InMemoryStore<string>()
    expect(await store.get('nonexistent')).toBeUndefined()
  })

  it('returns undefined for expired entry', async () => {
    const store = new InMemoryStore<string>({ maxAgeMs: 1000, maxSize: 100, pruneStrategy: 'ttl' })
    await store.set('key1', 'value1')
    expect(await store.get('key1')).toBe('value1')
    vi.advanceTimersByTime(1001)
    expect(await store.get('key1')).toBeUndefined()
  })

  it('has returns true/false correctly', async () => {
    const store = new InMemoryStore<string>()
    expect(await store.has('key1')).toBe(false)
    await store.set('key1', 'value1')
    expect(await store.has('key1')).toBe(true)
  })

  it('delete removes entry and returns count', async () => {
    const store = new InMemoryStore<string>()
    await store.set('key1', 'value1')
    expect(await store.delete('key1')).toBe(1)
    expect(await store.get('key1')).toBeUndefined()
  })

  it('delete returns 0 for missing key', async () => {
    const store = new InMemoryStore<string>()
    expect(await store.delete('nonexistent')).toBe(0)
  })

  it('clear empties the store', async () => {
    const store = new InMemoryStore<string>()
    await store.set('a', '1')
    await store.set('b', '2')
    await store.clear()
    expect(await store.size()).toBe(0)
  })

  it('size returns correct count', async () => {
    const store = new InMemoryStore<string>()
    expect(await store.size()).toBe(0)
    await store.set('a', '1')
    await store.set('b', '2')
    expect(await store.size()).toBe(2)
  })

  it('prune with ttl strategy removes expired entries', async () => {
    const store = new InMemoryStore<string>({ maxAgeMs: 1000, maxSize: 100, pruneStrategy: 'hybrid' })
    await store.set('old', 'old')
    vi.advanceTimersByTime(2000)
    await store.set('new', 'new')
    const pruned = await store.prune({ maxAgeMs: 1000, pruneStrategy: 'ttl' })
    expect(pruned).toBe(1)
    expect(await store.get('old')).toBeUndefined()
    expect(await store.get('new')).toBe('new')
  })

  it('prune with lru strategy removes oldest accessed', async () => {
    const store = new InMemoryStore<string>({ maxSize: 100, pruneStrategy: 'lru' })
    await store.set('a', '1')
    vi.advanceTimersByTime(100)
    await store.set('b', '2')
    vi.advanceTimersByTime(100)
    await store.set('c', '3')

    await store.get('b')
    await store.get('c')

    const pruned = await store.prune({ maxSize: 2, pruneStrategy: 'lru' })
    expect(pruned).toBe(1)
    expect(await store.get('a')).toBeUndefined()
  })

  it('prune with hybrid strategy does ttl first, then lru', async () => {
    const store = new InMemoryStore<string>({ maxAgeMs: 10_000, maxSize: 10, pruneStrategy: 'hybrid' })
    await store.set('old', 'old')
    vi.advanceTimersByTime(5000)
    await store.set('keep1', 'keep1')
    await store.set('keep2', 'keep2')

    let pruned = await store.prune({ maxAgeMs: 1000, pruneStrategy: 'ttl' })
    expect(pruned).toBe(1)
    expect(await store.get('old')).toBeUndefined()

    await store.set('extra', 'extra')
    pruned = await store.prune({ maxSize: 2, pruneStrategy: 'lru' })
    expect(pruned).toBe(1)
    expect(await store.size()).toBe(2)
  })

  it('set triggers auto-prune when over maxSize', async () => {
    const store = new InMemoryStore<string>({ maxAgeMs: 60000, maxSize: 3, pruneStrategy: 'hybrid' })
    await store.set('a', '1')
    await store.set('b', '2')
    await store.set('c', '3')
    await store.set('d', '4')
    expect(await store.size()).toBeLessThanOrEqual(3)
  })

  it('expire marks entry for future expiry', async () => {
    const store = new InMemoryStore<string>({ maxAgeMs: 60000, maxSize: 100, pruneStrategy: 'hybrid' })
    await store.set('key1', 'value1')
    store.expire('key1', 1000)
    expect(await store.get('key1')).toBe('value1')
    vi.advanceTimersByTime(1001)
    expect(await store.get('key1')).toBeUndefined()
  })

  it('stats returns total entries and oldest date', async () => {
    const store = new InMemoryStore<string>()
    const t0 = 1_000_000_000_000
    await store.set('a', '1')
    vi.advanceTimersByTime(1000)
    await store.set('b', '2')

    const stats = await store.stats()
    expect(stats.totalEntries).toBe(2)
    expect(stats.oldestEntry!.getTime()).toBe(t0)
  })
})
