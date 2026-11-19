/**
 * src/mcp/names.ts
 *
 * Declared and registered names for MCP tools (ADR-047). A member declares
 * `mcp.<server>.<tool>` in `allowed-tools`; the tool call carries
 * `mcp__<server>__<tool>`. The server name has no `__`, so the two forms convert
 * without ambiguity. No imports: this module loads with every member.
 */

const DECLARED_MCP = /^mcp\.([a-z0-9][a-z0-9-]*)\.(.+)$/
const PROVIDER_SAFE_NAME = /^[A-Za-z0-9_-]{1,64}$/

export function parseDeclaredMcpTool(declared: string): { server: string; tool: string } | null {
  const match = DECLARED_MCP.exec(declared)
  return match ? { server: match[1], tool: match[2] } : null
}

export function mcpRegistryName(server: string, tool: string): string {
  return `mcp__${server}__${tool}`
}

/** A tool the model can be offered: its provider-facing name must be a valid function name. */
export function isRegistrableMcpTool(server: string, tool: string): boolean {
  return PROVIDER_SAFE_NAME.test(mcpRegistryName(server, tool))
}
