import type { Artifact } from '../../core/types.ts'

export interface AgentResult {
  role: string
  output: string
  artifacts: Artifact[]
}
