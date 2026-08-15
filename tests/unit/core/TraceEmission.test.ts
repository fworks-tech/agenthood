import { describe, it, expect, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { BaseAgent } from '../../../src/agents/base/BaseAgent.ts'
import { ReActLoop } from '../../../src/reasoning/ReActLoop.ts'
import { ToolRegistry } from '../../../src/tools/ToolRegistry.ts'
import { createTestContext } from '../../helpers/testContext.ts'
import { Tracer } from '../../../src/core/Tracer.ts'
import { JSONFileTraceStore } from '../../../src/core/TraceStore.ts'
import type { ILLMProvider } from '../../../src/llm/ILLMProvider.ts'
import type { ITool } from '../../../src/tools/ITool.ts'
import type { TraceEnvelope } from '../../../src/core/types.ts'

class TestAgent extends BaseAgent {
  role = 'test-agent'
  protected tools: ITool[] = []

  protected async getSystemPrompt(): Promise<string> {
    return 'test system prompt'
  }
}

function stubLlm(content: string): ILLMProvider {
  return {
    complete: vi.fn().mockResolvedValue({
      content,
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      model: 'stub-model',
    }),
    stream: vi.fn(),
    embed: vi.fn(),
    getContextWindow: vi.fn().mockReturnValue(8192),
  }
}

interface Harness {
  agent: TestAgent
  tracer: Tracer
  store: JSONFileTraceStore
  context: ReturnType<typeof createTestContext>
  dir: string
}

async function makeHarness(llm: ILLMProvider, correlationId?: string): Promise<Harness> {
  const dir = mkdtempSync(join(tmpdir(), 'agenthood-e2e-trace-'))
  const store = new JSONFileTraceStore(join(dir, 'traces.ndjson'))
  const tracer = new Tracer(100, store, 60_000)
  const agent = new TestAgent(llm, new ReActLoop(llm, new ToolRegistry()), new ToolRegistry())
  const context = createTestContext({ tracer, correlationId })
  return { agent, tracer, store, context, dir }
}

const REQUIRED_FIELDS: Array<keyof TraceEnvelope> = [
  'member',
  'inputHash',
  'outputHash',
  'durationMs',
  'cost',
  'status',
  'correlationId',
  'timestamp',
  'source',
]

describe('trace emission end-to-end', () => {
  it('emits an envelope with all required fields populated through flush and store', async () => {
    const { agent, tracer, store, context, dir } = await makeHarness(stubLlm('a fine review'))
    try {
      await agent.run('review this diff', context)
      await tracer.flush()

      const traces = await store.query()
      expect(traces).toHaveLength(1)
      const env = traces[0]
      for (const field of REQUIRED_FIELDS) {
        expect(env[field], field).not.toBeNull()
        expect(env[field], field).not.toBeUndefined()
      }
      expect(env.tokenCount.input).toBe(10)
      expect(env.tokenCount.output).toBe(20)
      expect(env.tokenCount.total).toBe(30)
      expect(env.cost).toBeGreaterThanOrEqual(0)
      expect(env.status).toBe('success')
      expect(env.source).toBe('api')
      expect(env.member).toBe('test-agent')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('propagates the correlation id from the context into the envelope', async () => {
    const correlationId = `corr-${randomUUID()}`
    const { agent, tracer, store, context, dir } = await makeHarness(stubLlm('out'), correlationId)
    try {
      await agent.run('task', context)
      await tracer.flush()
      const env = (await store.query())[0]
      expect(env.correlationId).toBe(correlationId)
      expect(await store.query({ correlationId })).toHaveLength(1)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('records an error-status envelope when the run fails', async () => {
    const failingLlm: ILLMProvider = {
      ...stubLlm(''),
      complete: vi.fn().mockRejectedValue(new Error('provider exploded')),
    }
    const { agent, tracer, store, context, dir } = await makeHarness(failingLlm)
    try {
      await expect(agent.run('task', context)).rejects.toThrow('provider exploded')
      await tracer.flush()

      const env = (await store.query())[0]
      expect(env.status).toBe('error')
      expect(env.member).toBe('test-agent')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('records an empty-output envelope without crashing', async () => {
    const { agent, tracer, store, context, dir } = await makeHarness(stubLlm(''))
    try {
      await agent.run('task', context)
      await tracer.flush()

      const env = (await store.query())[0]
      expect(env.status).toBe('success')
      expect(env.output).toBe('')
      expect(env.outputHash).toBeTruthy()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
