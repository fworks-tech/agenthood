import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getMemberQualityScore } from '../../../src/core/qualityScore.ts'
import { BaseAgent } from '../../../src/agents/base/BaseAgent.ts'
import { ReActLoop } from '../../../src/reasoning/ReActLoop.ts'
import { ToolRegistry } from '../../../src/tools/ToolRegistry.ts'
import { createTestContext } from '../../helpers/testContext.ts'
import type { ILLMProvider } from '../../../src/llm/ILLMProvider.ts'
import type { ITool } from '../../../src/tools/ITool.ts'

class TestAgent extends BaseAgent {
  role = 'test-agent'
  protected tools: ITool[] = []

  protected async getSystemPrompt(): Promise<string> {
    return 'test system prompt'
  }
}

function stubLlm(): ILLMProvider {
  return {
    complete: vi.fn().mockResolvedValue({
      content: 'out',
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      model: 'mock-model',
    }),
    stream: vi.fn(),
    embed: vi.fn(),
    getContextWindow: vi.fn().mockReturnValue(8192),
  }
}

describe('getMemberQualityScore', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'agenthood-quality-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns the mean of the member baseline aggregates', () => {
    mkdirSync(join(dir, 'baselines'), { recursive: true })
    writeFileSync(
      join(dir, 'baselines', 'test-agent.json'),
      JSON.stringify({ member: 'test-agent', suiteName: 's', timestamp: 't', taskCount: 2, aggregate: { faithfulness: 0.8, relevance: 0.6 } }),
      'utf8',
    )
    expect(getMemberQualityScore('test-agent', join(dir, 'baselines'))).toBe(0.7)
  })

  it('returns null when no baseline file exists', () => {
    expect(getMemberQualityScore('test-agent', join(dir, 'baselines'))).toBeNull()
  })

  it('returns null when the aggregate is empty', () => {
    mkdirSync(join(dir, 'baselines'), { recursive: true })
    writeFileSync(join(dir, 'baselines', 'test-agent.json'), JSON.stringify({ member: 'test-agent', aggregate: {} }), 'utf8')
    expect(getMemberQualityScore('test-agent', join(dir, 'baselines'))).toBeNull()
  })

  it('returns null for corrupt baseline files', () => {
    mkdirSync(join(dir, 'baselines'), { recursive: true })
    writeFileSync(join(dir, 'baselines', 'test-agent.json'), '{ nope', 'utf8')
    expect(getMemberQualityScore('test-agent', join(dir, 'baselines'))).toBeNull()
  })
})

describe('BaseAgent quality stamping', () => {
  it('stamps qualityScore from the member baseline when present', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'agenthood-quality-'))
    mkdirSync(join(dir, '.agenthood', 'baselines'), { recursive: true })
    writeFileSync(
      join(dir, '.agenthood', 'baselines', 'test-agent.json'),
      JSON.stringify({ member: 'test-agent', suiteName: 's', timestamp: 't', taskCount: 1, aggregate: { faithfulness: 0.9 } }),
      'utf8',
    )
    try {
      const llm = stubLlm()
      const agent = new TestAgent(llm, new ReActLoop(llm, new ToolRegistry()), new ToolRegistry())
      const context = createTestContext({
        project: { localPath: dir, name: 'proj' },
      })
      await agent.run('task', context)
      expect(context.tracer.getRecent(1)[0].qualityScore).toBe(0.9)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('keeps qualityScore null without a baseline', async () => {
    const llm = stubLlm()
    const agent = new TestAgent(llm, new ReActLoop(llm, new ToolRegistry()), new ToolRegistry())
    const context = createTestContext()
    await agent.run('task', context)
    expect(context.tracer.getRecent(1)[0].qualityScore).toBeNull()
  })
})
