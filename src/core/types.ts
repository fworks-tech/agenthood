export interface Project {
  localPath: string
  name: string
  stack?: TechStack
}

export interface TechStack {
  languages?: string[]
  frameworks?: string[]
  packageManager?: string
}

export interface Convention {
  name: string
  value: string
}

export interface Tracer {
  startSpan(name: string): void
  endSpan(name: string, data?: Record<string, unknown>): void
}

export type ArtifactType = 'code' | 'test' | 'doc' | 'review' | 'report'

export interface Artifact {
  type: ArtifactType
  path: string
  content: string
  createdBy: string
}

export interface ShortTermMemory {
  add(message: string): void
  getRecent(n: number): string[]
  clear(): void
}

export interface LongTermMemory {
  store(key: string, value: unknown): Promise<void>
  retrieve(key: string): Promise<unknown>
}

export interface EpisodicMemory {
  record(episode: string, outcome: string): Promise<void>
  recall(query: string): Promise<string[]>
  getEpisode(id: string): Promise<{ episode: string; outcome: string; timestamp: string } | null>
}

export interface ProjectMemory {
  getConventions(): Promise<Convention[]>
  getArchitecturalDecisions(): Promise<string[]>
}

export type CausalRelationType = 'CAUSED' | 'INFLUENCED' | 'PRECEDENT_FOR'

export interface DecisionLog {
  record(entry: DecisionLogEntry): Promise<void>
  search(query: string, filters?: { member?: string; tags?: string[] }): Promise<Array<{ entry: DecisionLogEntry; score: number; matchField: string }>>
  recent(count?: number): Promise<DecisionLogEntry[]>
  get(id: string): Promise<DecisionLogEntry | undefined>
  all(): Promise<DecisionLogEntry[]>
  addCausalRelationship(sourceId: string, targetId: string, relationshipType: CausalRelationType): Promise<void>
  traceDecisionChain(id: string): Promise<DecisionLogEntry[]>
  analyzeDecisionImpact(id: string): Promise<DecisionLogEntry[]>
}

export type DecisionLogEntry = {
  id: string
  timestamp: string
  member: string
  task: string
  decision: string
  rationale: string
  alternatives: Array<{ option: string; reason: string }>
  outcome: string
  tags: string[]
  confidence?: number
  decisionMaker?: string
  validFrom?: string
  validUntil?: string
  reasoningEmbedding?: number[]
}

export interface EvalResult {
  episodeId: string
  scores: Record<string, number>
  durationMs?: number
  metadata?: {
    member?: string
    skill?: string
    task?: string
  }
}
