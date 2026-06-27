import type { IProtocol } from './protocols/IProtocol.js'

export type StepType = 'agent' | 'human-in-loop' | 'parallel' | 'goal' | 'tool'

export interface WorkflowStep {
  name: string
  type: StepType
  protocol?: IProtocol<unknown, unknown>
  input?: unknown
  agentName?: string
  task?: string
  subSteps?: WorkflowStep[]
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
