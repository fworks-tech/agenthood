import { vi } from 'vitest'
import { BaseAgent } from '../../src/agents/base/BaseAgent.ts'
import { ReActLoop } from '../../src/reasoning/ReActLoop.ts'
import { ToolRegistry } from '../../src/tools/ToolRegistry.ts'
import type { ILLMProvider } from '../../src/llm/ILLMProvider.ts'
import type { ExecutionContext } from '../../src/core/ExecutionContext.ts'
import type { LongTermMemory } from '../../src/core/types.ts'
import type { ITool } from '../../src/tools/ITool.ts'
import type { ResidualMemory } from '../../src/memory/ResidualMemory.ts'
import type { EpisodeLearner } from '../../src/evals/EpisodeLearner.ts'

export class TestAgent extends BaseAgent {
  role = 'test-agent'
  protected tools: ITool[] = []

  protected async getSystemPrompt(): Promise<string> {
    return 'test system prompt'
  }
}

export function createMockLLM(): ILLMProvider {
  return {
    complete: vi.fn().mockResolvedValue({
      content: 'mock output',
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      model: 'mock-model',
    }),
    stream: vi.fn(),
    embed: vi.fn(),
    getContextWindow: vi.fn().mockReturnValue(8192),
  }
}

/** Typed access to the protected getSystemPrompt on any agent under test. */
export function asPromptable<T>(
  agent: T,
): { getSystemPrompt(ctx: ExecutionContext): Promise<string> } {
  return agent as unknown as { getSystemPrompt(ctx: ExecutionContext): Promise<string> }
}

export function createAgentHarness(): {
  llm: ILLMProvider
  toolRegistry: ToolRegistry
  loop: ReActLoop
  mockLongTerm: LongTermMemory
  mockResidual: ResidualMemory
  mockLearner: EpisodeLearner
} {
  const llm = createMockLLM()
  const toolRegistry = new ToolRegistry()
  const loop = new ReActLoop(llm, toolRegistry)

  const mockLongTerm: LongTermMemory = {
    store: vi.fn(),
    retrieve: vi.fn(),
  }

  const mockResidual: ResidualMemory = {
    record: vi.fn(),
    decay: vi.fn(),
    getActive: vi.fn().mockReturnValue([]),
    toPromptHints: vi.fn().mockReturnValue(''),
    clear: vi.fn(),
    count: vi.fn().mockReturnValue(0),
  }

  const mockLearner: EpisodeLearner = {
    learn: vi.fn().mockResolvedValue(undefined),
  }

  return { llm, toolRegistry, loop, mockLongTerm, mockResidual, mockLearner }
}
