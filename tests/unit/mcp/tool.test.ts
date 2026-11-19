import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'node:url'
import { McpStdioClient } from '../../../src/mcp/client.ts'
import { McpTool } from '../../../src/mcp/tool.ts'
import { McpServerError } from '../../../src/mcp/errors.ts'
import { parseDeclaredMcpTool, mcpRegistryName, isRegistrableMcpTool } from '../../../src/mcp/names.ts'
import { toRegistryToolNames } from '../../../src/members/toolVocabulary.ts'

const FIXTURE = fileURLToPath(new URL('../../fixtures/mcp-fixture-server.mjs', import.meta.url))
const audit = async () => {}

describe('MCP tool names', () => {
  it('parses the declared form and rejects everything else', () => {
    expect(parseDeclaredMcpTool('mcp.fixture.echo')).toEqual({ server: 'fixture', tool: 'echo' })
    expect(parseDeclaredMcpTool('mcp.fixture.issues.list')).toEqual({ server: 'fixture', tool: 'issues.list' })
    expect(parseDeclaredMcpTool('mcp.Fixture.echo')).toBeNull()
    expect(parseDeclaredMcpTool('mcp.fixture')).toBeNull()
    expect(parseDeclaredMcpTool('file.read')).toBeNull()
  })

  it('maps the declared form to the provider-safe registry name', () => {
    expect(mcpRegistryName('fixture', 'echo')).toBe('mcp__fixture__echo')
    expect(isRegistrableMcpTool('fixture', 'echo')).toBe(true)
    expect(isRegistrableMcpTool('fixture', 'issues.list')).toBe(false)
    expect(isRegistrableMcpTool('fixture', 'x'.repeat(60))).toBe(false)
  })

  it('maps declared MCP names to registry names and leaves vocabulary names alone', () => {
    expect(toRegistryToolNames(['mcp.fixture.echo', 'file.read'])).toEqual(['mcp__fixture__echo', 'read_file'])
  })
})

describe('McpTool', () => {
  it('forwards a call to its server and returns the text', async () => {
    const client = await McpStdioClient.start('fixture', { command: process.execPath, args: [FIXTURE] })
    try {
      const tools = await client.listTools()
      const tool = new McpTool(client, tools.find((t) => t.name === 'echo')!, audit)
      expect(tool.name).toBe('mcp__fixture__echo')
      expect(await tool.execute({ text: 'hi' })).toEqual({ success: true, output: 'hi' })
    } finally {
      await client.close()
    }
  })

  it('returns a tool error that names the server when the call is rejected', async () => {
    const client = await McpStdioClient.start('fixture', { command: process.execPath, args: [FIXTURE] })
    try {
      const tool = new McpTool(client, { name: 'missing', description: '', inputSchema: { type: 'object' } }, audit)
      const result = await tool.execute({})
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/^MCP server "fixture": .*unknown tool missing/)
    } finally {
      await client.close()
    }
  })

  it('rethrows a dead server so the run cannot continue without it', async () => {
    const client = await McpStdioClient.start('dying', { command: process.execPath, args: [FIXTURE, 'crash-on-call'] })
    const tool = new McpTool(client, { name: 'echo', description: '', inputSchema: { type: 'object' } }, audit)
    await expect(tool.execute({ text: 'x' })).rejects.toBeInstanceOf(McpServerError)
    await client.close()
  })
})
