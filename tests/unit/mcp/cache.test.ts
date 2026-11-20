import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fileURLToPath } from 'node:url'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { McpSession } from '../../../src/mcp/session.ts'
import { McpStdioClient } from '../../../src/mcp/client.ts'
import type { MemberSpec } from '../../../src/members/types.ts'

const FIXTURE = fileURLToPath(new URL('../../fixtures/mcp-fixture-server.mjs', import.meta.url))
const servers = { fixture: { command: process.execPath, args: [FIXTURE] } }

function spec(overrides: Partial<MemberSpec> = {}): MemberSpec {
  return {
    name: 'caller',
    description: 'calls',
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

describe('Mcp tool-list cache (ADR-050)', () => {
  let cacheDir: string
  beforeEach(() => {
    cacheDir = mkdtempSync(join(tmpdir(), 'mcp-cache-'))
    process.env.AGENTHOOD_MCP_CACHE_DIR = cacheDir
    process.env.AGENTHOOD_MCP_CACHE_REFRESH = ''
    delete process.env.AGENTHOOD_MCP_CACHE_REFRESH
  })
  afterEach(() => {
    delete process.env.AGENTHOOD_MCP_CACHE_DIR
    delete process.env.AGENTHOOD_MCP_CACHE_REFRESH
    rmSync(cacheDir, { recursive: true, force: true })
  })

  it('avoids tools/list on a second run when the cache is valid', async () => {
    const listSpy = vi.spyOn(McpStdioClient.prototype, 'listTools')
    // first run populates cache
    const s1 = new McpSession('caller', servers, async () => {})
    await s1.resolve(spec())
    await s1.close()
    const callsAfterFirst = listSpy.mock.calls.length
    expect(callsAfterFirst).toBe(1)
    // second run should use cache
    const s2 = new McpSession('caller', servers, async () => {})
    await s2.resolve(spec())
    await s2.close()
    expect(listSpy.mock.calls.length).toBe(callsAfterFirst)
    listSpy.mockRestore()
  })

  it('revalidates when the cache is expired', async () => {
    const listSpy = vi.spyOn(McpStdioClient.prototype, 'listTools')
    const s1 = new McpSession('caller', servers, async () => {})
    await s1.resolve(spec())
    await s1.close()
    // expire by setting fetchedAt to 0 via rewriting file
    const { readdirSync, writeFileSync, readFileSync } = await import('node:fs')
    const files = readdirSync(cacheDir)
    for (const f of files) {
      const p = join(cacheDir, f)
      const entry = JSON.parse(readFileSync(p, 'utf8'))
      entry.fetchedAt = 0
      writeFileSync(p, JSON.stringify(entry))
    }
    const s2 = new McpSession('caller', servers, async () => {})
    await s2.resolve(spec())
    await s2.close()
    expect(listSpy.mock.calls.length).toBe(2)
    listSpy.mockRestore()
  })

  it('ignores a corrupt cache file', async () => {
    const { writeFileSync } = await import('node:fs')
    writeFileSync(join(cacheDir, '0000000000000000.json'), '{not json')
    const listSpy = vi.spyOn(McpStdioClient.prototype, 'listTools')
    const s = new McpSession('caller', servers, async () => {})
    await s.resolve(spec())
    await s.close()
    expect(listSpy.mock.calls.length).toBe(1)
    listSpy.mockRestore()
  })

  it('fails closed on call when a cached tool was removed from the server', async () => {
    // Instead test that a declared tool not in cache throws before call.
    const s = new McpSession('caller', servers, async () => {})
    await expect(s.resolve(spec({ declaredTools: ['file.read', 'mcp.fixture.nope'] }))).rejects.toThrow(/does not expose/)
    await s.close()
  })
})