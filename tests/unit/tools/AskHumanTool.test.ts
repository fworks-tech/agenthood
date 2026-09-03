import { describe, it, expect } from 'vitest'
import { AskHumanTool, AskHumanSignal, askHumanInputSchema } from '../../../src/tools/human/AskHumanTool.ts'
import { createTestContext } from '../../helpers/testContext.ts'

describe('AskHumanTool', () => {
  it('advertises the ask_human name with question required', () => {
    const tool = new AskHumanTool()
    expect(tool.name).toBe('ask_human')
    expect(tool.inputSchema).toBe(askHumanInputSchema)
    expect(tool.inputSchema.required).toContain('question')
  })

  it('throws AskHumanSignal carrying the question and context payload', async () => {
    const tool = new AskHumanTool()
    const ctx = createTestContext()

    const attempt = tool.execute({ question: 'Which branch should I target?', context: 'release thread' }, ctx)
    await expect(attempt).rejects.toThrow(AskHumanSignal)
    await expect(attempt).rejects.toMatchObject({
      payload: { question: 'Which branch should I target?', context: 'release thread' },
    })
  })

  it('throws with question only when no context is given', async () => {
    const tool = new AskHumanTool()
    const ctx = createTestContext()

    let caught: unknown
    try {
      await tool.execute({ question: 'Proceed with the migration?' }, ctx)
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(AskHumanSignal)
    const signal = caught as AskHumanSignal
    expect(signal.payload).toEqual({ question: 'Proceed with the migration?' })
    expect(signal.message).toBe('Proceed with the migration?')
  })
})
