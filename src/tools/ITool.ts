import type { ExecutionContext } from '../core/ExecutionContext.js'
import type { JSONSchema } from '../llm/types.js'
import type { Artifact } from '../core/types.js'

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
