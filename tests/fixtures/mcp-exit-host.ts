// Starts one MCP server and exits without closing it: the exit hook must kill the child (ADR-047).
import { McpStdioClient } from '../../src/mcp/client.ts'

const client = await McpStdioClient.start('fixture', { command: process.execPath, args: [process.argv[2]] })
console.log((client as unknown as { child: { pid: number } }).child.pid)
process.exit(0)
