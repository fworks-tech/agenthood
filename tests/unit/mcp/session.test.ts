import { describe, it, expect, vi } from 'vitest'
import { fileURLToPath } from 'node:url'
import { McpSession } from '../../../src/mcp/session.ts'
import { McpServerError } from '../../../src/mcp/errors.ts'
import type { MemberSpec } from '../../../src/members/types.ts'
import type { McpRecord } from '../../../src/mcp/audit.ts'
import type { ITool } from '../../../src/tools/ITool.ts'
import { createTestContext } from '../../helpers/testContext.ts'

const FIXTURE = fileURLToPath(new URL('../../fixtures/mcp-fixture-server.mjs', import.meta.url))
const servers = { fixture: { command: process.execPath, args: [FIXTURE] } }

function spec(overrides: Partial<MemberSpec>): MemberSpec {
  return {
    name: 'caller',
    description: 'calls an MCP tool',
    category: 'engineering',
    tagline: 'calls',
    permissionProfile: 'standard',
    preferredProvider: 'anthropic',
    tools: ['file.read'],
    declaredTools: ['file.read', 'mcp.fixture.echo'],
    systemPrompt: '',
    sourcePath: 'custom:caller',
    ...overrides,
  }
}

describe('McpSession', () => {
  it('grants a declared server tool to a standard member and records the grant', async () => {
    const records: McpRecord[] = []
    const session = new McpSession('caller', servers, async (r) => { records.push(r) })
    try {
      const resolved = await session.resolve(spec({}))
      expect(resolved.tools).toEqual(['file.read', 'mcp.fixture.echo'])
      expect(session.instances().get('mcp.fixture.echo')?.name).toBe('mcp__fixture__echo')
      expect(records.map((r) => r.decision)).toEqual([
        'started, exposes 2 tool(s)',
        'granted mcp.fixture.echo',
      ])
    } finally {
      await session.close()
    }
  })

  it('starts nothing and grants nothing to a restricted member', async () => {
    const session = new McpSession('caller', servers, async () => {})
    const resolved = await session.resolve(spec({ permissionProfile: 'restricted' }))
    expect(resolved.tools).toEqual(['file.read'])
    expect(session.names()).toEqual([])
    await session.close()
  })

  it('starts nothing for a member with no MCP declarations', async () => {
    const session = new McpSession('caller', servers, async () => {})
    const plain = spec({ declaredTools: ['file.read'] })
    expect(await session.resolve(plain)).toBe(plain)
    expect(session.names()).toEqual([])
    await session.close()
  })

  it('fails closed when the member names a server that is not configured', async () => {
    const records: McpRecord[] = []
    const session = new McpSession('caller', {}, async (r) => { records.push(r) })
    await expect(session.resolve(spec({}))).rejects.toThrow(
      'member "caller" declares MCP tool "mcp.fixture.echo", but no MCP server "fixture" is configured',
    )
    expect(records[0]).toMatchObject({ outcome: 'failed' })
  })

  it('fails closed when the server does not expose the declared tool', async () => {
    const session = new McpSession('caller', servers, async () => {})
    await expect(session.resolve(spec({ declaredTools: ['mcp.fixture.nope'] })))
      .rejects.toThrow('member "caller" declares MCP tool "mcp.fixture.nope", which server "fixture" does not expose')
    await session.close()
  })

  it('fails the run with the server named when a server does not start', async () => {
    const broken = { ...servers, fixture: { command: process.execPath, args: [FIXTURE, 'fail-start'] } }
    const session = new McpSession('caller', broken, async () => {})
    const error = await session.resolve(spec({})).catch((e) => e)
    expect(error).toBeInstanceOf(McpServerError)
    expect(error.message).toMatch(/^MCP server "fixture" failed to start/)
    await session.close()
  })

  it('makes a closed server refuse calls, so no tool runs after the run ends', async () => {
    const session = new McpSession('caller', servers, async () => {})
    await session.resolve(spec({}))
    const tool = session.instances().get('mcp.fixture.echo')!
    await session.close()
    await expect(tool.execute({ text: 'late' }, createTestContext())).rejects.toBeInstanceOf(McpServerError)
  })

  it('records a server that dies during a call as a failed invocation', async () => {
    const records: McpRecord[] = []
    const dying = { fixture: { command: process.execPath, args: [FIXTURE, 'crash-on-call'] } }
    const session = new McpSession('caller', dying, async (r) => { records.push(r) })
    await session.resolve(spec({}))
    const tool = session.instances().get('mcp.fixture.echo')!
    await expect(tool.execute({ text: 'x' }, createTestContext())).rejects.toBeInstanceOf(McpServerError)
    expect(records.at(-1)).toEqual({ task: 'invoke fixture.echo', decision: 'server failed during the call', outcome: 'failed' })
    await session.close()
  })

  it('closes the servers when the member task throws, through within()', async () => {
    let tool: ITool | undefined
    await expect(McpSession.within('caller', { providers: [], mcpServers: servers }, createTestContext(), async (mcp) => {
      await mcp.resolve(spec({}))
      tool = mcp.instances().get('mcp.fixture.echo')
      throw new Error('task failed')
    })).rejects.toThrow('task failed')
    await expect(tool!.execute({ text: 'late' }, createTestContext())).rejects.toBeInstanceOf(McpServerError)
  })

  it('records a successful invocation without its arguments or result as a decision', async () => {
    const audit = vi.fn(async (_r: McpRecord) => {})
    const session = new McpSession('caller', servers, audit)
    await session.resolve(spec({}))
    const result = await session.instances().get('mcp.fixture.echo')!.execute({ text: 'secret-payload' }, createTestContext())
    expect(result).toEqual({ success: true, output: 'secret-payload' })
    expect(audit).toHaveBeenLastCalledWith({ task: 'invoke fixture.echo', decision: 'completed', outcome: 'completed' })
    await session.close()
  })
})
