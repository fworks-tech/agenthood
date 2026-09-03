import { describe, it, expect } from 'vitest'
import { AskHumanTool } from '../../../src/tools/human/AskHumanTool.ts'
import { AskHumanSignal } from '../../../src/tools/human/AskHumanSignal.ts'
import { createTestContext } from '../../helpers/testContext.ts'

describe('AskHumanTool', () => {
  it('throws AskHumanSignal carrying the fx questions', async () => {
    const tool = new AskHumanTool()
    const questions = { questions: [{ label: 'Ship it?', description: 'Ready?', options: ['yes', 'no'] }] }
    const ctx = createTestContext()

    const err = await tool.execute(questions, ctx).catch((e) => e)
    expect(err).toBeInstanceOf(AskHumanSignal)
    expect(err.questions).toEqual(questions)
  })

  it('rejects empty questions as a tool failure, not a park', async () => {
    const tool = new AskHumanTool()
    const ctx = createTestContext()

    const result = await tool.execute({ questions: [] }, ctx)
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/non-empty questions/)
  })

  it('rejects malformed input as a tool failure, not a park', async () => {
    const tool = new AskHumanTool()
    const ctx = createTestContext()

    const result = await tool.execute({ questions: [{ description: 'no label' }] }, ctx)
    expect(result.success).toBe(false)
  })

  it('rejects oversize questions as a tool failure, not a park', async () => {
    const tool = new AskHumanTool()
    const ctx = createTestContext()

    const longLabel = await tool.execute({ questions: [{ label: 'x'.repeat(501) }] }, ctx)
    expect(longLabel.success).toBe(false)
    const tooMany = await tool.execute({ questions: Array.from({ length: 11 }, (_, i) => ({ label: `q${i}` })) }, ctx)
    expect(tooMany.success).toBe(false)
  })
})
