import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fileURLToPath } from 'node:url'
import { MemberRunner } from '../../src/runtime/MemberRunner.ts'
import { MemberRegistry } from '../../src/members/MemberRegistry.ts'
import type { CustomMemberDefinition, ProviderName } from '../../src/members/types.ts'
import { AgentRegistry } from '../../src/core/AgentRegistry.ts'
import { AnomalyDetector } from '../../src/core/AnomalyDetector.ts'
import { EpisodeLearner } from '../../src/evals/EpisodeLearner.ts'
import { StubProvider, STUB_PROVIDER_ENV } from '../../src/llm/providers/StubProvider.ts'
import { McpTool } from '../../src/mcp/tool.ts'
import { McpStdioClient } from '../../src/mcp/client.ts'
import type { LLMConfig } from '../../src/llm/types.ts'
import { createTestContext } from '../helpers/testContext.ts'

process.env[STUB_PROVIDER_ENV] = '1'

const FIXTURE = fileURLToPath(new URL('../fixtures/mcp-fixture-server.mjs', import.meta.url))

const CUSTOM: CustomMemberDefinition = {
  name: 'mcp-caller',
  description: 'Calls the fixture MCP server',
  systemPrompt: 'Use the MCP echo tool to answer.',
  permissionProfile: 'standard',
  preferredProvider: 'stub' as ProviderName,
  tools: ['mcp.fixture.echo', 'file.read'],
}

const CONFIG: LLMConfig = {
  providers: [{ name: 'stub' }],
  mcpServers: { fixture: { command: process.execPath, args: [FIXTURE] } },
}

function makeRunner() {
  const members = new MemberRegistry()
  members.register(CUSTOM)
  const runner = new MemberRunner({
    agents: new AgentRegistry(),
    members,
    episodeLearner: new EpisodeLearner(),
    anomalyDetector: new AnomalyDetector(),
    alertsPath: 'test-alerts.ndjson',
  })
  runner.ctx = createTestContext()
  const decisions: Array<{ id: string; task: string; decision: string; tags: string[]; outcome: string }> = []
  const provenance: Array<{ metadata?: Record<string, unknown> }> = []
  runner.ctx.memory.decisions.record = vi.fn(async (entry) => {
    decisions.push(entry as never)
  })
  runner.ctx.memory.provenance.track = vi.fn(async (entry) => {
    provenance.push(entry as never)
    return entry as never
  }) as never
  return { runner, decisions, provenance }
}

describe('MCP tools in a member run (ADR-047)', () => {
  beforeEach(() => {
    StubProvider.resetScript()
  })

  afterEach(() => {
    StubProvider.resetScript()
    vi.restoreAllMocks()
  })

  it('runs the declared tool through the real loop, audits it, and closes the server', async () => {
    StubProvider.enqueueScript([
      { toolCalls: [{ id: 'call_1', name: 'mcp__fixture__echo', args: { text: 'hello from mcp' } }] },
      { content: 'done' },
    ])
    const execute = vi.spyOn(McpTool.prototype, 'execute')
    const close = vi.spyOn(McpStdioClient.prototype, 'close')
    const { runner, decisions, provenance } = makeRunner()

    const result = await runner.runMemberTask('mcp-caller', 'echo the greeting', CONFIG)

    expect(result.output).toBe('done')
    expect(await execute.mock.results[0].value).toEqual({ success: true, output: 'hello from mcp' })
    expect(close).toHaveBeenCalled()

    const mcpDecisions = decisions.filter((d) => d.tags.includes('mcp'))
    expect(mcpDecisions.map((d) => d.task)).toEqual([
      'start MCP server fixture',
      'grant MCP tools to mcp-caller',
      'invoke fixture.echo',
    ])
    expect(mcpDecisions.every((d) => d.outcome === 'completed')).toBe(true)
    expect(JSON.stringify(decisions)).not.toContain('hello from mcp')

    const linked = new Set(provenance.map((p) => p.metadata?.decisionId))
    for (const decision of mcpDecisions) expect(linked.has(decision.id)).toBe(true)
  })

  it('fails the run before the first model call when the configured server is missing', async () => {
    StubProvider.enqueueScript([{ content: 'never reached' }])
    const { runner } = makeRunner()
    const config: LLMConfig = { providers: [{ name: 'stub' }] }

    await expect(runner.runMemberTask('mcp-caller', 'echo', config))
      .rejects.toThrow('member "mcp-caller" declares MCP tool "mcp.fixture.echo", but no MCP server "fixture" is configured')
  })
})
