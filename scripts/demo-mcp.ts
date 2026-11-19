/**
 * Runs a host-registered member that uses the fixture MCP server (ADR-047), then
 * prints the servers, the tools the member was granted, and the MCP decisions
 * the run wrote. Usage: npm run demo:mcp -- "<task>"
 */

import { fileURLToPath } from 'node:url'
import { loadConfig } from '../src/commands/config.ts'
import { ApplicationContext } from '../src/runtime/ApplicationContext.ts'
import { parseDeclaredMcpTool } from '../src/mcp/names.ts'

const FIXTURE = fileURLToPath(new URL('../tests/fixtures/mcp-fixture-server.mjs', import.meta.url))
const MEMBER = 'mcp-demo'

const baseConfig = await loadConfig()
const config = { ...baseConfig, mcpServers: { demo: { command: process.execPath, args: [FIXTURE] } } }
const app = await ApplicationContext.create(process.cwd(), config, {
  customMembers: [{
    name: MEMBER,
    description: 'Demo member that calls the fixture MCP server',
    systemPrompt: 'Answer the task by calling the MCP tools you are given. Report each tool output.',
    permissionProfile: 'standard',
    preferredProvider: 'opencode-go',
    tools: ['mcp.demo.echo', 'mcp.demo.add'],
  }],
})

const spec = app.members.get(MEMBER)
const task = process.argv.slice(2).join(' ') || 'Call echo with the text "pong", then call add with 2 and 3, and report both results.'

console.log(`servers: ${Object.entries(config.mcpServers).map(([name, s]) => `${name} (${s.command} ${s.args.join(' ')})`).join(', ')}`)
console.log(`member ${MEMBER} declares: ${(spec.declaredTools ?? []).filter((t) => parseDeclaredMcpTool(t)).join(', ')}`)

const started = new Date().toISOString()
const result = await app.runner.runMemberTask(MEMBER, task, config)
console.log(`\noutput:\n${result.output}\n`)

const decisions = (await app.ctx.memory.decisions.all())
  .filter((d) => d.member === MEMBER && d.tags.includes('mcp') && d.timestamp >= started)
console.log('trace (mcp decisions, in order):')
for (const d of decisions) console.log(`  ${d.timestamp}  ${d.outcome.padEnd(9)} ${d.task}: ${d.decision}`)

process.exit(0)
