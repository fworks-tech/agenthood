import type { Artifact } from '../../core/types.js'

export interface AgentResult {
  role: string
  output: string
  artifacts: Artifact[]
}
