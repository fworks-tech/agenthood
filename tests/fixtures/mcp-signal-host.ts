// Starts one MCP server, prints the child pid, then raises SIGTERM on itself so the
// process-level hook (ADR-047 item 8) must kill the child. Exit code 143 expected.
import { McpStdioClient } from '../../src/mcp/client.ts'

const client = await McpStdioClient.start('fixture', { command: process.execPath, args: [process.argv[2]] })
console.log((client as unknown as { child: { pid: number } }).child.pid)
process.kill(process.pid, 'SIGTERM')