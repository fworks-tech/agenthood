export interface RetentionPolicy {
  maxAgeMs?: number
  maxSize?: number
  pruneStrategy: 'ttl' | 'lru' | 'hybrid'
}

export interface MemoryEntry<T> {
  key: string
  value: T
  createdAt: Date
  lastAccessed: Date
}

export interface IMemoryStore<T> {
  set(key: string, value: T, ttlMs?: number): Promise<void>
  get(key: string): Promise<T | undefined>
  delete(key: string): Promise<number>
  has(key: string): Promise<boolean>
  clear(): Promise<void>
  size(): Promise<number>
  prune(policy: RetentionPolicy): Promise<number>
  stats(): Promise<{ totalEntries: number; oldestEntry: Date | null }>
}
