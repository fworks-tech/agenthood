import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'node:url'
import { McpStdioClient, inheritedEnv, INHERITED_ENV } from '../../../src/mcp/client.ts'
import { McpServerError, McpCallError } from '../../../src/mcp/errors.ts'

const FIXTURE = fileURLToPath(new URL('../../fixtures/mcp-fixture-server.mjs', import.meta.url))

const fixture = (mode?: string) => ({ command: process.execPath, args: mode ? [FIXTURE, mode] : [FIXTURE] })

describe('McpStdioClient', () => {
  it('completes the handshake, lists tools and calls them', async () => {
    const client = await McpStdioClient.start('fixture', fixture())
    try {
      const tools = await client.listTools()
      expect(tools.map((t) => t.name)).toEqual(['echo', 'add'])
      expect(await client.callTool('echo', { text: 'hello' })).toEqual({ text: 'hello', isError: false })
      expect(await client.callTool('add', { a: 2, b: 3 })).toEqual({ text: '5', isError: false })
    } finally {
      await client.close()
    }
  })

  it('fails to start a command that does not exist, with the server named', async () => {
    await expect(McpStdioClient.start('ghost', { command: 'agenthood-no-such-binary', args: [] }))
      .rejects.toThrow(McpServerError)
  })

  it('fails to start a server that exits before the handshake', async () => {
    await expect(McpStdioClient.start('early', fixture('fail-start')))
      .rejects.toThrow(/MCP server "early" failed to start/)
  })

  it('reports a server that dies on a call as fatal, and refuses later calls', async () => {
    const client = await McpStdioClient.start('dying', fixture('crash-on-call'))
    try {
      await expect(client.callTool('echo', { text: 'x' })).rejects.toThrow(McpServerError)
      await expect(client.callTool('echo', { text: 'x' })).rejects.toThrow(/MCP server "dying" is not running/)
    } finally {
      await client.close()
    }
  })

  it('reports a JSON-RPC error as a call error and keeps the server alive', async () => {
    const client = await McpStdioClient.start('fixture', fixture())
    try {
      await expect(client.callTool('missing', {})).rejects.toThrow(McpCallError)
      expect(await client.callTool('echo', { text: 'still up' })).toEqual({ text: 'still up', isError: false })
    } finally {
      await client.close()
    }
  })

  it('times out a silent call as a call error, not a server failure', async () => {
    const client = await McpStdioClient.start('slow', fixture('hang-on-call'), { callTimeoutMs: 200 })
    try {
      await expect(client.callTool('echo', { text: 'x' })).rejects.toThrow(/tools\/call timed out after 200 ms/)
      expect((await client.listTools()).length).toBe(2)
    } finally {
      await client.close()
    }
  })

  it('kills the child process on close', async () => {
    const client = await McpStdioClient.start('fixture', fixture())
    const pid = (client as unknown as { child: { pid: number } }).child.pid
    await client.close()
    expect(() => process.kill(pid, 0)).toThrow()
  })

  it('reduces the child environment to the six platform keys', () => {
    process.env.AGENTHOOD_TEST_SECRET = 'should-not-leak'
    try {
      const env = inheritedEnv()
      for (const key of Object.keys(env)) expect(INHERITED_ENV).toContain(key)
      expect(env.AGENTHOOD_TEST_SECRET).toBeUndefined()
      expect(INHERITED_ENV).toHaveLength(6)
    } finally {
      delete process.env.AGENTHOOD_TEST_SECRET
    }
  })

  it('registers the exit, SIGINT and SIGTERM hooks on first start', async () => {
    const client = await McpStdioClient.start('fixture', fixture())
    try {
      expect(process.listeners('exit').length).toBeGreaterThan(0)
      expect(process.listeners('SIGINT').length).toBeGreaterThan(0)
      expect(process.listeners('SIGTERM').length).toBeGreaterThan(0)
    } finally {
      await client.close()
    }
  })
})
