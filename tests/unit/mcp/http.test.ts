import { describe, it, expect } from 'vitest'
import { createServer } from 'node:http'
import { McpHttpClient } from '../../../src/mcp/http.ts'
import { McpServerError, McpCallError } from '../../../src/mcp/errors.ts'

function startHttpServer(handler: (req: any, res: any) => void): Promise<{ url: string; close: () => void }> {
  return new Promise((resolve) => {
    const server = createServer(handler)
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number }
      resolve({ url: `http://127.0.0.1:${addr.port}`, close: () => server.close() })
    })
  })
}

const TOOLS = [
  { name: 'echo', description: 'echo', inputSchema: { type: 'object', properties: { text: { type: 'string' } } } },
]

function rpc(body: any) {
  if (body.method === 'initialize') {
    return { jsonrpc: '2.0', id: body.id, result: { protocolVersion: '2025-11-25', capabilities: { tools: {} }, serverInfo: { name: 'httpfix', version: '1' } } }
  }
  if (body.method === 'tools/list') {
    return { jsonrpc: '2.0', id: body.id, result: { tools: TOOLS } }
  }
  if (body.method === 'tools/call') {
    const { name, arguments: args } = body.params
    if (name === 'echo') return { jsonrpc: '2.0', id: body.id, result: { content: [{ type: 'text', text: String(args.text) }] } }
    return { jsonrpc: '2.0', id: body.id, error: { code: -32602, message: `unknown tool ${name}` } }
  }
  return { jsonrpc: '2.0', id: body.id, error: { code: -32601, message: 'method not found' } }
}

function jsonHandler(req: any, res: any) {
  let data = ''
  req.on('data', (c: any) => (data += c))
  req.on('end', () => {
    const body = JSON.parse(data)
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(rpc(body)))
  })
}

describe('McpHttpClient', () => {
  it('completes handshake, lists tools and calls them', async () => {
    const { url, close } = await startHttpServer(jsonHandler)
    try {
      const client = await McpHttpClient.start('httpfix', { transport: 'http', url })
      const tools = await client.listTools()
      expect(tools.map((t) => t.name)).toEqual(['echo'])
      expect(await client.callTool('echo', { text: 'hi' })).toEqual({ text: 'hi', isError: false })
      await client.close()
    } finally {
      close()
    }
  })

  it('fails to start when the server is unreachable', async () => {
    await expect(McpHttpClient.start('ghost', { transport: 'http', url: 'http://127.0.0.1:1' })).rejects.toThrow(McpServerError)
  })

  it('reports a JSON-RPC error as a call error and keeps the server alive', async () => {
    const { url, close } = await startHttpServer(jsonHandler)
    try {
      const client = await McpHttpClient.start('httpfix', { transport: 'http', url })
      await expect(client.callTool('missing', {})).rejects.toThrow(McpCallError)
      expect(await client.callTool('echo', { text: 'still up' })).toEqual({ text: 'still up', isError: false })
      await client.close()
    } finally {
      close()
    }
  })

  it('sends resolved headers to the server', async () => {
    let seen: any = null
    const { url, close } = await startHttpServer((req, res) => {
      seen = req.headers
      let data = ''
      req.on('data', (c: any) => (data += c))
      req.on('end', () => {
        const body = JSON.parse(data)
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(rpc(body)))
      })
    })
    try {
      const client = await McpHttpClient.start('httpfix', { transport: 'http', url, headers: { Authorization: 'Bearer t0k', 'X-Custom': 'plain' } })
      await client.callTool('echo', { text: 'h' })
      expect(seen.authorization).toBe('Bearer t0k')
      expect(seen['x-custom']).toBe('plain')
      await client.close()
    } finally {
      close()
    }
  })

  it('supports SSE responses', async () => {
    const { url, close } = await startHttpServer((req, res) => {
      let data = ''
      req.on('data', (c: any) => (data += c))
      req.on('end', () => {
        const body = JSON.parse(data)
        res.setHeader('Content-Type', 'text/event-stream')
        res.write('data: ' + JSON.stringify(rpc(body)) + '\n\n')
        res.end()
      })
    })
    try {
      const client = await McpHttpClient.start('httpfix', { transport: 'http', url })
      expect(await client.callTool('echo', { text: 'sse' })).toEqual({ text: 'sse', isError: false })
      await client.close()
    } finally {
      close()
    }
  })
})