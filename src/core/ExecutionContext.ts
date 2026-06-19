import type { ILLMProvider } from '../llm/ILLMProvider.js'
import type { Message } from '../llm/types.js'
import type {
  Project,
  Tracer,
  Artifact,
  ShortTermMemory,
  LongTermMemory,
  EpisodicMemory,
  ProjectMemory,
} from './types.js'

export interface ExecutionContext {
  executionId: string
  project: Project
  memory: {
    shortTerm: ShortTermMemory
    longTerm: LongTermMemory
    episodic: EpisodicMemory
    project: ProjectMemory
  }
  llm: ILLMProvider
  prompts: { build(templateName: string, variables: Record<string, unknown>): Message }
  tracer: Tracer
  artifacts: Artifact[]
}
