import { describe, it, expect } from 'vitest'
import { mkdtempSync, rmSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DecisionLog } from '../../../src/memory/DecisionLog.ts'
import { ProvenanceStore } from '../../../src/memory/ProvenanceStore.ts'
import { recordMcpDecision } from '../../../src/mcp/audit.ts'
import type { ExecutionContext } from '../../../src/core/ExecutionContext.ts'

describe('MCP audit trail', () => {
  it('links every MCP decision to its own provenance entry, and the chain verifies', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'agenthood-mcp-audit-'))
    try {
      const decisions = new DecisionLog({ decisionsDir: join(dir, 'decisions') })
      const provenance = new ProvenanceStore({ provenanceDir: join(dir, 'provenance') })
      const context = { executionId: 'exec-1', memory: { decisions, provenance } } as unknown as ExecutionContext

      await recordMcpDecision(context, 'mcp-demo', { task: 'start MCP server demo', decision: 'started', outcome: 'completed' })
      await recordMcpDecision(context, 'mcp-demo', { task: 'invoke demo.echo', decision: 'completed', outcome: 'completed' })
      await recordMcpDecision(context, 'mcp-demo', { task: 'invoke demo.add', decision: 'call failed', outcome: 'failed' })

      const all = await decisions.all()
      expect(all).toHaveLength(3)
      expect(readdirSync(join(dir, 'provenance'))).toHaveLength(3)
      const linked = new Set((await provenance.recent(10)).map((p) => p.metadata?.decisionId))
      for (const decision of all) expect(linked.has(decision.id)).toBe(true)
      expect((await provenance.verifyChain()).valid).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
