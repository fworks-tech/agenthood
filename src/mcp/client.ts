/**
 * src/mcp/client.ts
 *
 * STDIO MCP client for the servers a host declares in `mcpServers` (ADR-047).
 * Newline-delimited JSON-RPC 2.0 over the child's stdin and stdout. The child
 * gets no shell and only the platform-essential environment.
 */

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { once } from 'node:events'
import { createInterface } from 'node:readline'
import type { JSONSchema, McpServerConfig } from '../llm/types.ts'
import { McpCallError, McpServerError } from './errors.ts'

const PROTOCOL_VERSION = '2025-11-25'
const START_TIMEOUT_MS = 10_000
const CALL_TIMEOUT_MS = 30_000
export const INHERITED_ENV = ['PATH', 'SystemRoot', 'HOME', 'USERPROFILE', 'TEMP', 'TMP']
const METHOD_NOT_FOUND = -32601

export interface McpClient {
  readonly name: string
  listTools(): Promise<McpToolInfo[]>
  callTool(name: string, args: Record<string, unknown>): Promise<{ text: string; isError: boolean }>
  close(): Promise<void>
}

export interface McpToolInfo {
  name: string
  description: string
  inputSchema: JSONSchema
}

interface PendingRequest {
  resolve: (result: unknown) => void
  reject: (error: Error) => void
  timer: NodeJS.Timeout
}

const live = new Set<McpStdioClient>()
let exitHooked = false

/** Children must not outlive the host: exit, Ctrl-C and kill take them down too. */
function hookProcessExit(): void {
  if (exitHooked) return
  exitHooked = true
  const killAll = () => { for (const client of live) client.kill() }
  process.once('exit', killAll)
  for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143]] as const) {
    process.once(signal, () => {
      killAll()
      process.exit(code)
    })
  }
}

export function inheritedEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {}
  for (const key of INHERITED_ENV) {
    if (process.env[key] !== undefined) env[key] = process.env[key]
  }
  return env
}

export class McpStdioClient implements McpClient {
  private readonly pending = new Map<number, PendingRequest>()
  private nextId = 1
  private failure: string | null = null

  private constructor(
    readonly name: string,
    private readonly child: ChildProcessWithoutNullStreams,
    private readonly callTimeoutMs: number,
  ) {
    createInterface({ input: child.stdout }).on('line', (line) => this.onLine(line))
    child.stderr.resume()
    child.on('error', (err) => this.fail(`failed to run: ${err.message}`))
    child.on('exit', (code, signal) => this.fail(`exited (${signal ?? `code ${code}`})`))
  }

  static async start(name: string, config: McpServerConfig, options: { callTimeoutMs?: number } = {}): Promise<McpStdioClient> {
    if (!config.command) throw new McpServerError(name, 'failed to start: missing command')
    const child = spawn(config.command, config.args ?? [], {
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...inheritedEnv(), ...(config.env ?? {}) },
    })
    const client = new McpStdioClient(name, child, options.callTimeoutMs ?? CALL_TIMEOUT_MS)
    live.add(client)
    hookProcessExit()
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

  /** Synchronous kill, for process-exit hooks where awaiting is impossible. */
  kill(): void {
    live.delete(this)
    if (this.child.pid !== undefined && this.child.exitCode === null && this.child.signalCode === null) {
      this.child.kill()
    }
  }

  async close(): Promise<void> {
    const exited = this.child.pid !== undefined && this.child.exitCode === null && this.child.signalCode === null
      ? once(this.child, 'exit')
      : null
    this.child.stdin.end()
    this.kill()
    await exited
  }

  private request(method: string, params: unknown, timeoutMs: number): Promise<unknown> {
    if (this.failure) return Promise.reject(new McpServerError(this.name, `is not running: ${this.failure}`))
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new McpCallError(this.name, `${method} timed out after ${timeoutMs} ms`))
      }, timeoutMs)
      this.pending.set(id, { resolve, reject, timer })
      this.write({ jsonrpc: '2.0', id, method, params })
    })
  }

  private notify(method: string): void {
    this.write({ jsonrpc: '2.0', method })
  }

  private write(message: unknown): void {
    this.child.stdin.write(JSON.stringify(message) + '\n')
  }

  private onLine(line: string): void {
    let message: { id?: number | string; method?: string; result?: unknown; error?: { code: number; message: string } }
    try {
      message = JSON.parse(line)
    } catch {
      return
    }
    if (message.method !== undefined && message.id !== undefined) {
      this.write({ jsonrpc: '2.0', id: message.id, error: { code: METHOD_NOT_FOUND, message: 'method not found' } })
      return
    }
    const entry = typeof message.id === 'number' ? this.pending.get(message.id) : undefined
    if (!entry) return
    this.pending.delete(message.id as number)
    clearTimeout(entry.timer)
    if (message.error) entry.reject(new McpCallError(this.name, `${message.error.message} (code ${message.error.code})`))
    else entry.resolve(message.result)
  }

  private fail(reason: string): void {
    if (this.failure) return
    this.failure = reason
    live.delete(this)
    for (const [id, entry] of this.pending) {
      clearTimeout(entry.timer)
      this.pending.delete(id)
      entry.reject(new McpServerError(this.name, reason))
    }
  }
}
