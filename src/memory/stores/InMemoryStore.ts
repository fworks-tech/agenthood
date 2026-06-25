import type { IMemoryStore, MemoryEntry, RetentionPolicy } from '../IMemoryStore.js'

interface StoreEntry<T> {
  key: string
  value: T
  createdAt: Date
  lastAccessed: Date
  expiresAt: Date | null
}

export class InMemoryStore<T> implements IMemoryStore<T> {
  private entries: Map<string, StoreEntry<T>> = new Map()
  private policy: RetentionPolicy

  constructor(policy: RetentionPolicy = { maxAgeMs: 30 * 60 * 1000, maxSize: 1000, pruneStrategy: 'hybrid' }) {
    this.policy = policy
  }

  async set(key: string, value: T, ttlMs?: number): Promise<void> {
    const now = new Date()
    this.entries.set(key, {
      key,
      value,
      createdAt: now,
      lastAccessed: now,
      expiresAt: ttlMs !== undefined && ttlMs > 0 ? new Date(now.getTime() + ttlMs) : null,
    })
    if (this.policy.maxSize && this.entries.size > this.policy.maxSize) {
      await this.prune(this.policy)
    }
  }

  async get(key: string): Promise<T | undefined> {
    const entry = this.entries.get(key)
    if (!entry) return undefined
    if (this.isExpired(entry) || this.isPastPolicyMaxAge(entry)) {
      this.entries.delete(key)
      return undefined
    }
    entry.lastAccessed = new Date()
    return entry.value
  }

  async delete(key: string): Promise<number> {
    return this.entries.delete(key) ? 1 : 0
  }

  async has(key: string): Promise<boolean> {
    const entry = this.entries.get(key)
    if (!entry) return false
    if (this.isExpired(entry) || this.isPastPolicyMaxAge(entry)) {
      this.entries.delete(key)
      return false
    }
    return true
  }

  async clear(): Promise<void> {
    this.entries.clear()
  }

  async size(): Promise<number> {
    await this.removeExpired()
    return this.entries.size
  }

  async prune(policy: RetentionPolicy): Promise<number> {
    let pruned = 0

    if (policy.pruneStrategy === 'ttl' || policy.pruneStrategy === 'hybrid') {
      const maxAge = policy.maxAgeMs ?? this.policy.maxAgeMs
      if (maxAge) {
        const cutoff = Date.now() - maxAge
        for (const [key, entry] of this.entries) {
          if (entry.createdAt.getTime() < cutoff) {
            this.entries.delete(key)
            pruned++
          }
        }
      }
    }

    if (
      policy.pruneStrategy === 'lru' ||
      (policy.pruneStrategy === 'hybrid' && this.entries.size > (policy.maxSize ?? this.policy.maxSize ?? Infinity))
    ) {
      const maxSize = policy.maxSize ?? this.policy.maxSize
      if (maxSize && this.entries.size > maxSize) {
        const sorted = Array.from(this.entries.values()).sort(
          (a, b) => a.lastAccessed.getTime() - b.lastAccessed.getTime(),
        )
        const toRemove = this.entries.size - maxSize
        for (let i = 0; i < toRemove && i < sorted.length; i++) {
          this.entries.delete(sorted[i].key)
          pruned++
        }
      }
    }

    return pruned
  }

  async stats(): Promise<{ totalEntries: number; oldestEntry: Date | null }> {
    await this.removeExpired()
    const values = Array.from(this.entries.values())
    if (values.length === 0) return { totalEntries: 0, oldestEntry: null }
    let oldest = values[0].createdAt
    for (const entry of values) {
      if (entry.createdAt.getTime() < oldest.getTime()) {
        oldest = entry.createdAt
      }
    }
    return { totalEntries: values.length, oldestEntry: oldest }
  }

  expire(key: string, ttlMs: number): void {
    const entry = this.entries.get(key)
    if (entry) {
      entry.expiresAt = new Date(Date.now() + ttlMs)
    }
  }

  private isExpired(entry: StoreEntry<T>): boolean {
    return entry.expiresAt !== null && entry.expiresAt.getTime() <= Date.now()
  }

  private isPastPolicyMaxAge(entry: StoreEntry<T>): boolean {
    if (!this.policy.maxAgeMs || entry.expiresAt !== null) return false
    return Date.now() - entry.createdAt.getTime() > this.policy.maxAgeMs
  }

  private async removeExpired(): Promise<void> {
    const now = Date.now()
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt && entry.expiresAt.getTime() <= now) {
        this.entries.delete(key)
      } else if (this.isPastPolicyMaxAge(entry)) {
        this.entries.delete(key)
      }
    }
  }
}
