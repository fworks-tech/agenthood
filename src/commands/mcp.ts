/**
 * agenthood mcp
 *
 * Start an MCP server that exposes agenthood skills as MCP tools.
 * Uses stdio transport for compatibility with Claude Code and other MCP clients.
 */

import type { CommandDescriptor } from './types.ts'

export const command: CommandDescriptor = {
  name: 'mcp',
  description: 'Start MCP server exposing skills as tools',
  handler: () => mcp(),
}

export async function mcp(): Promise<void> {
  const { startMcpServer } = await import('../mcp/server.ts')
  await startMcpServer()
}
