import type { ILLMProvider } from '../llm/ILLMProvider.js'
import type { Message } from '../llm/types.js'
import type { RedactionFilter } from './RedactionFilter.js'
import type { ProvenanceStore } from '../memory/ProvenanceStore.js'
import type {
  Project,
  Tracer,
  Artifact,
  ShortTermMemory,
  LongTermMemory,
  EpisodicMemory,
  ProjectMemory,
  DecisionLog,
  TraceSource,
} from './types.js'

export interface ExecutionContext {
  executionId: string
  correlationId?: string
  /** Invocation origin, stamped onto every emitted trace envelope */
  source?: TraceSource
  project: Project
  memory: {
    shortTerm: ShortTermMemory
    longTerm: LongTermMemory
    episodic: EpisodicMemory
    project: ProjectMemory
    decisions: DecisionLog
    provenance: ProvenanceStore
  }
  llm: ILLMProvider
  prompts: { build(templateName: string, variables: Record<string, unknown>): Message }
  tracer: Tracer
  artifacts: Artifact[]
  oracle?: { ask(question: string): Promise<string> }
  skillsCatalog?: string
  /** Optional Sentry error reporting configuration from .agenthood/config.json */
  sentry?: { dsn?: string }
  /** Shared redactor guarding trace, decision, and provenance payloads */
  redactor?: RedactionFilter
}
