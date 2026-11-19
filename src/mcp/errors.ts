/** The server cannot serve the run: it failed to start, or it died. Fatal to the run (ADR-047). */
export class McpServerError extends Error {
  constructor(readonly server: string, reason: string) {
    super(`MCP server "${server}" ${reason}`)
    this.name = 'McpServerError'
  }
}

/** One call went wrong (JSON-RPC error or timeout). The server is still alive. */
export class McpCallError extends Error {
  constructor(readonly server: string, reason: string) {
    super(`MCP server "${server}": ${reason}`)
    this.name = 'McpCallError'
  }
}
