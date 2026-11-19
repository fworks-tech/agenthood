/**
 * src/mcp/audit.ts
 *
 * One MCP event is one decision plus one provenance entry linked by
 * `metadata.decisionId`, the shape a run already uses (ADR-047). Arguments and
 * results are never recorded: a tool call may carry secrets.
 */

import { randomUUID } from 'node:crypto'
import type { ExecutionContext } from '../core/ExecutionContext.ts'
import { redactEventText } from '../core/RunEventBus.ts'

export interface McpRecord {
  task: string
  decision: string
  outcome: 'completed' | 'failed'
}

export type McpAudit = (record: McpRecord) => Promise<void>

export async function recordMcpDecision(context: ExecutionContext, member: string, record: McpRecord): Promise<void> {
  const timestamp = new Date().toISOString()
  const id = `dec-${Date.now()}-${randomUUID()}`
  const task = redactEventText(context, record.task).slice(0, 2000)
  const decision = redactEventText(context, record.decision).slice(0, 2000)
  await context.memory.decisions.record({
    id,
    timestamp,
    member,
    task,
    decision,
    rationale: decision,
    alternatives: [],
    outcome: record.outcome,
    tags: ['mcp'],
    decisionMaker: member,
  })
  // one provenance file per entityId: a shared id would overwrite earlier events and break the chain
  await context.memory.provenance.track({
    entityId: id,
    entityType: 'decision',
    activityId: `mcp:${member}`,
    agentId: member,
    agentType: 'software_agent',
    role: 'generator',
    sourceDocument: task.slice(0, 500),
    timestamp,
    metadata: { decisionId: id, success: record.outcome === 'completed' },
  })
}
