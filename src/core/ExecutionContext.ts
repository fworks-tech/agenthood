import type { ILLMProvider } from '../llm/ILLMProvider.ts'
import type { ISkillManifest } from '../skills/discovery/ISkillManifest.ts'
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
  /** Discovered skills, so a per-run tool registry can expose `activate_skill` (#531). */
  skillManifests?: Map<string, ISkillManifest>
  /** Skill directories activated in this run: read access without a prompt (#536). */
  skillAllowlist?: Set<string>
  /** Per-repo agent guidance read from AGENTS.md / CLAUDE.md (#567) */
  repoInstructions?: string
  /** The host opted out of the injection; recorded in the run's decision tags (#1071). */
  repoInstructionsOptOut?: boolean
  /** Tools a skill declares via `allowed-tools`; undefined means unrestricted (#582) */
  skillAllowedTools?: (skillName: string) => string[] | undefined
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
