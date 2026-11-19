/**
 * src/mcp/tool.ts
 *
 * A server tool as the runtime sees it: an ITool that forwards to one server.
 */

import type { ITool, ToolResult } from '../tools/ITool.ts'
import type { JSONSchema } from '../llm/types.ts'
import { McpCallError, McpServerError } from './errors.ts'
import { mcpRegistryName } from './names.ts'
import type { McpStdioClient, McpToolInfo } from './client.ts'

export class McpTool implements ITool {
  readonly name: string
  readonly description: string
  readonly inputSchema: JSONSchema

  constructor(private readonly client: McpStdioClient, private readonly info: McpToolInfo) {
    this.name = mcpRegistryName(client.name, info.name)
    this.description = `[MCP ${client.name}] ${info.description}`
    this.inputSchema = info.inputSchema
  }

  async execute(input: unknown): Promise<ToolResult> {
    const label = `MCP server "${this.client.name}" tool "${this.info.name}"`
    try {
      const result = await this.client.callTool(this.info.name, (input ?? {}) as Record<string, unknown>)
      if (result.isError) {
        return { success: false, output: '', error: `${label} returned an error: ${result.text || 'no detail'}` }
      }
      return { success: true, output: result.text }
    } catch (err) {
      if (err instanceof McpServerError) throw err
      if (err instanceof McpCallError) return { success: false, output: '', error: err.message }
      throw err
    }
  }
}
