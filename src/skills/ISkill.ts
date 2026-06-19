import type { ExecutionContext } from '../core/ExecutionContext.js'
import type { JSONSchema } from '../llm/types.js'
import type { Artifact } from '../core/types.js'

export interface SkillResult {
  success: boolean
  output: string
  artifacts?: Artifact[]
  error?: string
}

export interface ISkill {
  name: string
  description: string
  inputSchema: JSONSchema
  execute(input: unknown, context: ExecutionContext): Promise<SkillResult>
}
