/**
 * src/mcp/session.ts
 *
 * The MCP servers one member run uses (ADR-047). A server starts only when the
 * member declares one of its tools, and every child it started is closed when
 * the run ends, on success, error or signal.
 */

import type { ITool } from '../tools/ITool.ts'
import type { LLMConfig, McpServerConfig } from '../llm/types.ts'
import type { ExecutionContext } from '../core/ExecutionContext.ts'
import type { MemberSpec } from '../members/types.ts'
import { MemberRegistry } from '../members/MemberRegistry.ts'
import { McpStdioClient, type McpToolInfo } from './client.ts'
import { McpServerError } from './errors.ts'
import { isRegistrableMcpTool, parseDeclaredMcpTool } from './names.ts'
import { McpTool } from './tool.ts'
import { recordMcpDecision, type McpAudit } from './audit.ts'

export class McpSession {
  private readonly clients: McpStdioClient[] = []
  private readonly tools = new Map<string, ITool>()

  constructor(
    private readonly member: string,
    private readonly servers: Record<string, McpServerConfig>,
    private readonly audit: McpAudit,
  ) {}

  /** Runs one member task with its MCP servers, closing them however the task ends (ADR-047). */
  static async within<T>(member: string, config: LLMConfig, context: ExecutionContext, run: (mcp: McpSession) => Promise<T>): Promise<T> {
    const session = new McpSession(member, config.mcpServers ?? {}, (record) => recordMcpDecision(context, member, record))
    try {
      return await run(session)
    } finally {
      await session.close()
    }
  }

  /** The member's spec with MCP names resolved: only what the profile grants and a started server exposes (ADR-047). */
  async resolve(spec: MemberSpec): Promise<MemberSpec> {
    if (!spec.declaredTools?.some((name) => parseDeclaredMcpTool(name)) || !MemberRegistry.carries(spec.permissionProfile, 'mcp')) return spec
    await this.start(spec.declaredTools)
    const tools = MemberRegistry.intersectDeclaredTools(
      spec.declaredTools.join(' '),
      spec.permissionProfile,
      MemberRegistry.grantsFor(spec.permissionProfile, this.names()),
    )
    const granted = tools.filter((t) => parseDeclaredMcpTool(t))
    if (granted.length > 0) {
      await this.audit({ task: `grant MCP tools to ${spec.name}`, decision: `granted ${granted.join(', ')}`, outcome: 'completed' })
    }
    return { ...spec, tools }
  }

  /** Starts the servers that the declared MCP names reference. Declared names outside MCP are ignored. */
  async start(declared: string[]): Promise<void> {
    const byServer = new Map<string, string[]>()
    for (const name of declared) {
      const ref = parseDeclaredMcpTool(name)
      if (ref) byServer.set(ref.server, [...(byServer.get(ref.server) ?? []), name])
    }
    for (const [server, names] of byServer) {
      await this.startServer(server, names)
    }
  }

  /** Declared names this session can grant, by the tools each started server exposes. */
  names(): string[] {
    return [...this.tools.keys()]
  }

  instances(): Map<string, ITool> {
    return this.tools
  }

  async close(): Promise<void> {
    await Promise.all(this.clients.map((client) => client.close()))
    this.clients.length = 0
  }

  private async startServer(server: string, names: string[]): Promise<void> {
    const config = this.servers[server]
    if (!config) {
      const reason = `declares MCP tool "${names[0]}", but no MCP server "${server}" is configured in .agenthood/config.json`
      await this.audit({ task: `start MCP server ${server}`, decision: `member "${this.member}" ${reason}`, outcome: 'failed' })
      throw new Error(`member "${this.member}" ${reason}`)
    }

    let client: McpStdioClient
    try {
      client = await McpStdioClient.start(server, config)
    } catch (err) {
      await this.audit({ task: `start MCP server ${server}`, decision: `failed: ${(err as Error).message}`, outcome: 'failed' })
      throw err
    }
    this.clients.push(client)

    let listed: McpToolInfo[]
    try {
      listed = await client.listTools()
    } catch (err) {
      const failure = new McpServerError(server, `failed to list tools: ${(err as Error).message}`)
      await this.audit({ task: `start MCP server ${server}`, decision: `failed: ${failure.message}`, outcome: 'failed' })
      throw failure
    }

    for (const info of listed) {
      if (isRegistrableMcpTool(server, info.name)) {
        this.tools.set(`mcp.${server}.${info.name}`, new McpTool(client, info, this.audit))
      }
    }
    for (const name of names) {
      if (!this.tools.has(name)) {
        const reason = `declares MCP tool "${name}", which server "${server}" does not expose`
        await this.audit({ task: `start MCP server ${server}`, decision: `member "${this.member}" ${reason}`, outcome: 'failed' })
        throw new Error(`member "${this.member}" ${reason}`)
      }
    }
    await this.audit({ task: `start MCP server ${server}`, decision: `started, exposes ${listed.length} tool(s)`, outcome: 'completed' })
  }
}
