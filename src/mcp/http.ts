/**
 * src/mcp/http.ts
 *
 * Streamable HTTP transport client for host-declared MCP servers (ADR-048).
 * Speaks JSON-RPC 2.0 over HTTP: requests are POSTs, responses are either a
 * single JSON object or an SSE stream. Fail-closed like the stdio client.
 */

import type { JSONSchema, McpServerConfig } from '../llm/types.ts'
import { McpCallError, McpServerError } from './errors.ts'
import type { McpClient, McpToolInfo } from './client.ts'
import { PROTOCOL_VERSION } from './cache.ts'

const START_TIMEOUT_MS = 10_000
const CALL_TIMEOUT_MS = 30_000

export class McpHttpClient implements McpClient {
  private sessionId: string | null = null
  private closed = false
  private nextId = 1
  private readonly callTimeoutMs: number

  private constructor(
    readonly name: string,
    private readonly config: McpServerConfig,
    options: { callTimeoutMs?: number } = {},
  ) {
    this.callTimeoutMs = options.callTimeoutMs ?? CALL_TIMEOUT_MS
  }

  static async start(name: string, config: McpServerConfig, options: { callTimeoutMs?: number } = {}): Promise<McpHttpClient> {
    const client = new McpHttpClient(name, config, options)
    try {
      await client.request('initialize', {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: 'agenthood', version: '1.0.0' },
      }, START_TIMEOUT_MS)
      client.notify('notifications/initialized')
      return client
    } catch (err) {
      await client.close()
      const reason = err instanceof Error ? err.message : String(err)
      throw new McpServerError(name, `failed to start: ${reason}`)
    }
  }

  async listTools(): Promise<McpToolInfo[]> {
    const tools: McpToolInfo[] = []
    let cursor: string | undefined
    do {
      const result = await this.request('tools/list', cursor ? { cursor } : {}, this.callTimeoutMs) as {
        tools?: Array<{ name: string; description?: string; inputSchema?: JSONSchema }>
        nextCursor?: string
      }
      for (const tool of result.tools ?? []) {
        tools.push({
          name: tool.name,
          description: tool.description ?? '',
          inputSchema: tool.inputSchema ?? { type: 'object', properties: {} },
        })
      }
      cursor = result.nextCursor
    } while (cursor)
    return tools
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<{ text: string; isError: boolean }> {
    const result = await this.request('tools/call', { name, arguments: args }, this.callTimeoutMs) as {
      content?: Array<{ type: string; text?: string }>
      isError?: boolean
    }
    const text = (result.content ?? [])
      .filter((part) => part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('\n')
    return { text, isError: result.isError === true }
  }

  async close(): Promise<void> {
    this.closed = true
  }

  private async request(method: string, params: unknown, timeoutMs: number): Promise<unknown> {
    if (this.closed) throw new McpServerError(this.name, 'is not running: closed')
    const id = this.nextId++
    const body = JSON.stringify({ jsonrpc: '2.0', id, method, params })
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      ...(this.config.headers ?? {}),
    }
    if (this.sessionId) headers['Mcp-Session-Id'] = this.sessionId

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      let response: Response
      try {
        response = await fetch(this.config.url as string, { method: 'POST', headers, body, signal: controller.signal, redirect: 'error' })
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err)
        throw new McpCallError(this.name, `${method} failed: ${reason}`)
      }

      if (!response.ok) {
        throw new McpCallError(this.name, `${method} returned HTTP ${response.status}`)
      }
      const sid = response.headers.get('mcp-session-id')
      if (sid) this.sessionId = sid

      const contentType = response.headers.get('content-type') ?? ''
      let result: unknown
      try {
        if (contentType.includes('text/event-stream')) {
          result = await this.readSse(response, id)
        } else {
          result = await response.json()
        }
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err)
        throw new McpCallError(this.name, `${method} failed: ${reason}`)
      }
      const msg = result as { id?: number; result?: unknown; error?: { code: number; message: string } }
      if (msg.error) throw new McpCallError(this.name, `${msg.error.message} (code ${msg.error.code})`)
      return msg.result
    } finally {
      clearTimeout(timer)
    }
  }

  private async readSse(response: Response, id: number): Promise<unknown> {
    const reader = response.body?.getReader()
    if (!reader) throw new McpCallError(this.name, 'no response body')
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (!data) continue
        let parsed: { id?: number; result?: unknown; error?: { code: number; message: string } }
        try {
          parsed = JSON.parse(data)
        } catch {
          continue
        }
        // Return on the matching response: a compliant server may keep the stream open.
        if (parsed.id === id) {
          reader.cancel().catch(() => {})
          return parsed
        }
      }
    }
    throw new McpCallError(this.name, 'no matching response in SSE stream')
  }

  private notify(method: string): void {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      ...(this.config.headers ?? {}),
    }
    if (this.sessionId) headers['Mcp-Session-Id'] = this.sessionId
    fetch(this.config.url as string, {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', method }),
      redirect: 'error',
    }).catch(() => {})
  }
}