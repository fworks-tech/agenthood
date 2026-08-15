import type { ExecutionContext } from '../core/ExecutionContext.ts'
import type { JSONSchema } from '../llm/types.ts'
import type { Artifact } from '../core/types.ts'

export interface ToolResult {
  success: boolean
  output: string
  artifacts?: Artifact[]
  error?: string
}

export interface ITool {
  name: string
  description: string
  inputSchema: JSONSchema
  execute(input: unknown, context: ExecutionContext): Promise<ToolResult>
}
