// Fixture MCP server for the client tests (ADR-047). Speaks newline-delimited
// JSON-RPC over stdio and advertises two harmless tools: echo and add.
// argv[2] selects a failure mode: "crash-on-call" exits on the first tools/call,
// "hang-on-call" never answers a tools/call, "fail-start" exits before initialize,
// "error-on-call" returns an isError tool result, "env-report" makes echo return
// the child's sorted environment variable names.
import { createInterface } from 'node:readline'

const mode = process.argv[2] ?? 'normal'
const TOOLS = [
  {
    name: 'echo',
    description: 'Returns the text it is given.',
    inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  },
  {
    name: 'add',
    description: 'Adds two numbers.',
    inputSchema: { type: 'object', properties: { a: { type: 'number' }, b: { type: 'number' } }, required: ['a', 'b'] },
  },
]

const send = (message) => process.stdout.write(JSON.stringify(message) + '\n')

if (mode === 'fail-start') process.exit(3)
// a server that ignores stdin EOF: only the host can end it
setInterval(() => {}, 60_000)

createInterface({ input: process.stdin }).on('line', (line) => {
  const message = JSON.parse(line)
  if (message.id === undefined) return
  if (message.method === 'initialize') {
    send({
      jsonrpc: '2.0',
      id: message.id,
      result: {
        protocolVersion: message.params.protocolVersion,
        capabilities: { tools: {} },
        serverInfo: { name: 'fixture', version: '1.0.0' },
      },
    })
  } else if (message.method === 'tools/list') {
    send({ jsonrpc: '2.0', id: message.id, result: { tools: TOOLS } })
  } else if (message.method === 'tools/call') {
    if (mode === 'crash-on-call') process.exit(1)
    if (mode === 'hang-on-call') return
    if (mode === 'error-on-call') {
      send({ jsonrpc: '2.0', id: message.id, result: { content: [{ type: 'text', text: 'boom' }], isError: true } })
      return
    }
    const { name, arguments: args } = message.params
    if (name === 'echo') {
      const text = mode === 'env-report'
        ? Object.keys(process.env).sort().join(',')
        : String(args.text)
      send({ jsonrpc: '2.0', id: message.id, result: { content: [{ type: 'text', text }] } })
    } else if (name === 'add') {
      send({ jsonrpc: '2.0', id: message.id, result: { content: [{ type: 'text', text: String(args.a + args.b) }] } })
    } else {
      send({ jsonrpc: '2.0', id: message.id, error: { code: -32602, message: `unknown tool ${name}` } })
    }
  } else {
    send({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'method not found' } })
  }
})
