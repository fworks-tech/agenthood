import type { IProtocol } from './protocols/IProtocol.ts'

export type StepType = 'agent' | 'human-in-loop' | 'parallel' | 'goal' | 'tool'

/**
 * Conditional step (#609): run only when an earlier step's output matches.
 * A missing or not-yet-run step fails closed — the step is skipped.
 */
export interface StepCondition {
  /** Name of the earlier step. */
  step: string
  contains?: string
  notContains?: string
}

export interface WorkflowStep {
  name: string
  type: StepType
  protocol?: IProtocol<unknown, unknown>
  input?: unknown
  agentName?: string
  task?: string
  subSteps?: WorkflowStep[]
  when?: StepCondition
}

export interface WorkflowContext {
  executionId: string
  artifacts: Map<string, unknown>
  stepResults: Map<string, unknown>
  metadata: Record<string, unknown>
}

export interface WorkflowDefinition {
  name: string
  description: string
  steps: WorkflowStep[]
}
