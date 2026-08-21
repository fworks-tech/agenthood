import type { ILLMProvider } from '../llm/ILLMProvider.ts'
import type { Message } from '../llm/types.ts'
import type { RedactionFilter } from './RedactionFilter.ts'
import type { RunEventBus } from './RunEventBus.ts'
import type { ProvenanceStore } from '../memory/ProvenanceStore.ts'
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
} from './types.ts'

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
  /** Execution-lifecycle event feed external hosts (e.g. atlaslink) subscribe to */
  events: RunEventBus
  artifacts: Artifact[]
  oracle?: { ask(question: string): Promise<string> }
  skillsCatalog?: string
  /** Optional Sentry error reporting configuration from .agenthood/config.json */
  sentry?: { dsn?: string }
  /** Shared redactor guarding trace, decision, and provenance payloads */
  redactor?: RedactionFilter
  /**
   * Mutable accumulator for LLM usage outside the reasoning loop (tool-level
   * calls). BaseAgent sums it into the trace token counts.
   */
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
}
