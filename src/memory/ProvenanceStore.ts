import { createHash } from 'node:crypto'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { writeFileAtomic } from '../utils/atomicWrite.ts'

export type ProvenanceAgentType = 'person' | 'software_agent' | 'organization'

export interface ProvenanceEntry {
  entityId: string
  entityType: string
  activityId: string
  agentId: string
  agentType?: ProvenanceAgentType
  role?: string
  sourceDocument?: string
  timestamp: string
  confidence?: number
  checksum?: string
  sequenceId?: number
  previousChecksum?: string
  invalidated?: boolean
  invalidatedAt?: string
  invalidatedBy?: string
  invalidatedReason?: string
  metadata?: Record<string, unknown>
}

export interface ProvenanceStoreOptions {
  provenanceDir?: string
}

export interface ChainVerification {
  valid: boolean
  brokenAt?: string
  detail?: string
}

const INVALIDATION_FIELDS = ['invalidated', 'invalidatedAt', 'invalidatedBy', 'invalidatedReason'] as const

export class ProvenanceStore {
  private provenanceDir: string
  private cache: Map<string, ProvenanceEntry> = new Map()

  constructor(options: ProvenanceStoreOptions = {}) {
    this.provenanceDir = options.provenanceDir ?? join(process.cwd(), '.agenthood', 'provenance')
    this.ensureDir()
  }

  async track(entry: Omit<ProvenanceEntry, 'checksum' | 'sequenceId' | 'previousChecksum'>): Promise<ProvenanceEntry> {
    return this.withLock(() => this.trackLocked(entry))
  }

  private trackLocked(entry: Omit<ProvenanceEntry, 'checksum' | 'sequenceId' | 'previousChecksum'>): ProvenanceEntry {
    this.loadCache()
    const sequenceId = this.nextSequenceId()
    const previous = this.lastEntryBySequence()
    const previousChecksum = previous?.checksum ?? null

    const pending: ProvenanceEntry = {
      ...entry,
      entityId: entry.entityId,
      sequenceId,
      previousChecksum: previousChecksum ?? undefined,
    }
    const checksum = this.computeChecksum(pending, previousChecksum)
    const stored: ProvenanceEntry = { ...pending, checksum }

    const safeId = this.sanitizeId(stored.entityId)
    writeFileAtomic(join(this.provenanceDir, `${safeId}.json`), JSON.stringify(stored, null, 2))
    this.cache.set(stored.entityId, stored)
    return stored
  }

  /** Serializes sequence assignment across processes. Two concurrent `run`s
   *  would otherwise both write N+1 and look like a tampered chain. A lock
   *  older than the stale window is removed: a crashed run must not wedge it. */
  private async withLock<T>(work: () => T): Promise<T> {
    const lockPath = join(this.provenanceDir, '.lock')
    const deadline = Date.now() + 5000
    let fd: number | undefined
    while (fd === undefined) {
      try {
        fd = openSync(lockPath, 'wx')
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err
        try {
          if (Date.now() - statSync(lockPath).mtimeMs > 30_000) {
            rmSync(lockPath, { force: true })
            continue
          }
        } catch {
          continue
        }
        if (Date.now() > deadline) {
          throw new Error(`ProvenanceStore: timed out waiting for ${lockPath}`, { cause: err })
        }
        await new Promise((resolve) => setTimeout(resolve, 25))
      }
    }
    try {
      return work()
    } finally {
      closeSync(fd)
      rmSync(lockPath, { force: true })
    }
  }

  async get(entityId: string): Promise<ProvenanceEntry | undefined> {
    const safeId = this.sanitizeId(entityId)
    if (this.cache.has(safeId)) return this.cache.get(safeId)

    const filePath = join(this.provenanceDir, `${safeId}.json`)
    if (!existsSync(filePath)) return undefined

    const raw = readFileSync(filePath, 'utf8')
    const entry = JSON.parse(raw) as ProvenanceEntry
    this.cache.set(safeId, entry)
    return entry
  }

  async recent(count: number = 10): Promise<ProvenanceEntry[]> {
    this.loadCache()
    return Array.from(this.cache.values())
      .sort((a, b) => (b.sequenceId ?? 0) - (a.sequenceId ?? 0))
      .slice(0, count)
  }

  count(): number {
    return this.cache.size
  }

  async invalidate(entityId: string, by: string, reason: string): Promise<void> {
    const entry = await this.get(entityId)
    if (!entry) throw new Error(`ProvenanceStore: entry "${entityId}" not found`)
    entry.invalidated = true
    entry.invalidatedAt = new Date().toISOString()
    entry.invalidatedBy = by
    entry.invalidatedReason = reason
    writeFileAtomic(join(this.provenanceDir, `${this.sanitizeId(entityId)}.json`), JSON.stringify(entry, null, 2))
    this.cache.set(entityId, entry)
  }

  async verifyChain(): Promise<ChainVerification> {
    const ordered = this.loadFromDisk()
      .filter((e) => typeof e.sequenceId === 'number')
      .sort((a, b) => (a.sequenceId ?? 0) - (b.sequenceId ?? 0))

    let previousChecksum: string | null = null
    for (const entry of ordered) {
      if (entry.previousChecksum !== (previousChecksum ?? undefined)) {
        return {
          valid: false,
          brokenAt: entry.entityId,
          detail: `linkage mismatch: expected previous checksum ${previousChecksum ?? '(none)'}, found ${entry.previousChecksum ?? '(none)'}`,
        }
      }
      const expected = this.computeChecksum(entry, previousChecksum)
      if (entry.checksum !== expected) {
        return {
          valid: false,
          brokenAt: entry.entityId,
          detail: `checksum mismatch: expected ${expected}, found ${entry.checksum}`,
        }
      }
      previousChecksum = entry.checksum ?? null
    }
    return { valid: true }
  }

  private loadFromDisk(): ProvenanceEntry[] {
    if (!existsSync(this.provenanceDir)) return []
    const entries: ProvenanceEntry[] = []
    for (const file of readdirSync(this.provenanceDir).filter((f) => f.endsWith('.json'))) {
      try {
        const raw = readFileSync(join(this.provenanceDir, file), 'utf8')
        entries.push(JSON.parse(raw) as ProvenanceEntry)
      } catch {
        // skip corrupt files
      }
    }
    return entries
  }

  private computeChecksum(entry: ProvenanceEntry, previousChecksum: string | null): string {
    const hashable: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(entry)) {
      if (key === 'checksum' || key === 'sequenceId' || key === 'previousChecksum') continue
      if ((INVALIDATION_FIELDS as readonly string[]).includes(key)) continue
      hashable[key] = value
    }
    const canonical = JSON.stringify(hashable, Object.keys(hashable).sort())
    return createHash('sha256').update(`${canonical}\n${previousChecksum ?? ''}`).digest('hex')
  }

  private nextSequenceId(): number {
    let max = 0
    for (const entry of this.cache.values()) {
      if (typeof entry.sequenceId === 'number' && entry.sequenceId > max) max = entry.sequenceId
    }
    return max + 1
  }

  private lastEntryBySequence(): ProvenanceEntry | undefined {
    let last: ProvenanceEntry | undefined
    for (const entry of this.cache.values()) {
      if (!last || (entry.sequenceId ?? 0) > (last.sequenceId ?? 0)) last = entry
    }
    return last
  }

  private loadCache(): void {
    if (!existsSync(this.provenanceDir)) return
    const files = readdirSync(this.provenanceDir).filter((f) => f.endsWith('.json'))
    for (const file of files) {
      const id = file.replace('.json', '')
      if (this.cache.has(id)) continue
      try {
        const raw = readFileSync(join(this.provenanceDir, file), 'utf8')
        const entry = JSON.parse(raw) as ProvenanceEntry
        this.cache.set(id, entry)
      } catch {
        // skip corrupt files
      }
    }
  }

  private sanitizeId(id: string): string {
    const safe = id.replace(/[^a-zA-Z0-9_-]/g, '')
    if (safe !== id) {
      throw new Error(`Invalid provenance entity id: "${id}", must match [a-zA-Z0-9_-]+`)
    }
    return safe
  }

  private ensureDir(): void {
    if (!existsSync(this.provenanceDir)) {
      mkdirSync(this.provenanceDir, { recursive: true })
    }
  }
}
