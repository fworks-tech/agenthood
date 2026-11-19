/**
 * src/mcp/tool.ts
 *
 * A server tool as the runtime sees it: an ITool that forwards to one server
 * and records every invocation (ADR-047).
 */

import type { ITool, ToolResult } from '../tools/ITool.ts'
import type { JSONSchema } from '../llm/types.ts'
import { McpCallError, McpServerError } from './errors.ts'
import { mcpRegistryName } from './names.ts'
import type { McpStdioClient, McpToolInfo } from './client.ts'
import type { McpAudit } from './audit.ts'

export class McpTool implements ITool {
  readonly name: string
  readonly description: string
  readonly inputSchema: JSONSchema

  constructor(
    private readonly client: McpStdioClient,
    private readonly info: McpToolInfo,
    private readonly audit: McpAudit,
  ) {
    this.name = mcpRegistryName(client.name, info.name)
    this.description = `[MCP ${client.name}] ${info.description}`
    this.inputSchema = info.inputSchema
  }

  async execute(input: unknown): Promise<ToolResult> {
    const server = this.client.name
    const label = `MCP server "${server}" tool "${this.info.name}"`
    const task = `invoke ${server}.${this.info.name}`
    try {
      const result = await this.client.callTool(this.info.name, (input ?? {}) as Record<string, unknown>)
      if (result.isError) {
        await this.audit({ task, decision: 'tool returned an error', outcome: 'failed' })
        return { success: false, output: '', error: `${label} returned an error: ${result.text || 'no detail'}` }
      }
      await this.audit({ task, decision: 'completed', outcome: 'completed' })
      return { success: true, output: result.text }
    } catch (err) {
      if (err instanceof McpServerError) {
        await this.audit({ task, decision: 'server failed during the call', outcome: 'failed' })
        throw err
      }
      if (err instanceof McpCallError) {
        await this.audit({ task, decision: 'call failed', outcome: 'failed' })
        return { success: false, output: '', error: err.message }
      }
      throw err
    }
  }
}
