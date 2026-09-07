import { describe, it, expect, vi, afterEach } from 'vitest'
import { ReActLoop, ShutdownRequestedError } from '../../../src/reasoning/ReActLoop.ts'
import { ToolRegistry } from '../../../src/tools/ToolRegistry.ts'
import { createTestContext } from '../../helpers/testContext.ts'
import { requestShutdown, resetShutdown } from '../../../src/core/shutdown.ts'
import type { ILLMProvider } from '../../../src/llm/ILLMProvider.ts'

function unusedProvider(): ILLMProvider {
  return {
    complete: vi.fn().mockResolvedValue({ content: 'x', usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, model: 'm' }),
    stream: vi.fn(),
    embed: vi.fn().mockResolvedValue([]),
    getContextWindow: () => 8192,
    setModel: vi.fn(),
  }
}

describe('ReActLoop graceful shutdown', () => {
  afterEach(() => resetShutdown())

  it('stops at the step boundary without calling the provider', async () => {
    const llm = unusedProvider()
    const loop = new ReActLoop(llm, new ToolRegistry())
    requestShutdown()
    await expect(loop.run('sys', 'task', createTestContext())).rejects.toThrow(ShutdownRequestedError)
    expect(llm.complete).not.toHaveBeenCalled()
  })

  it('exposes a work summary for the CLI', () => {
    const err = new ShutdownRequestedError(3, { promptTokens: 10, completionTokens: 5, totalTokens: 15 }, 'groq-x')
    expect(err.summary()).toContain('3 step')
    expect(err.summary()).toContain('groq-x')
    expect(err.summary()).toContain('15 tokens')
  })
})
