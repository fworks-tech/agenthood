import { describe, it, expect } from 'vitest'
import {
  AskHumanTool,
  AskHumanSignal,
  askHumanInputSchema,
  ASK_HUMAN_MAX_QUESTION_LENGTH,
  ASK_HUMAN_MAX_CONTEXT_LENGTH,
} from '../../../src/tools/human/AskHumanTool.ts'
import { SchemaValidationError } from '../../../src/core/SchemaValidator.ts'
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

  it('declares maxLength caps on question and context', () => {
    const props = askHumanInputSchema.properties ?? {}
    expect(props.question?.maxLength).toBe(ASK_HUMAN_MAX_QUESTION_LENGTH)
    expect(props.context?.maxLength).toBe(ASK_HUMAN_MAX_CONTEXT_LENGTH)
  })

  it('rejects an over-long question at the boundary', async () => {
    const tool = new AskHumanTool()
    const ctx = createTestContext()

    await expect(
      tool.execute({ question: 'x'.repeat(ASK_HUMAN_MAX_QUESTION_LENGTH + 1) }, ctx),
    ).rejects.toBeInstanceOf(SchemaValidationError)
  })

  it('rejects an over-long context at the boundary', async () => {
    const tool = new AskHumanTool()
    const ctx = createTestContext()

    await expect(
      tool.execute(
        { question: 'Proceed?', context: 'x'.repeat(ASK_HUMAN_MAX_CONTEXT_LENGTH + 1) },
        ctx,
      ),
    ).rejects.toBeInstanceOf(SchemaValidationError)
  })

  it('parks a question exactly at the cap', async () => {
    const tool = new AskHumanTool()
    const ctx = createTestContext()
    const question = 'x'.repeat(ASK_HUMAN_MAX_QUESTION_LENGTH)

    const attempt = tool.execute({ question }, ctx)
    await expect(attempt).rejects.toThrow(AskHumanSignal)
    await expect(attempt).rejects.toMatchObject({ payload: { question } })
  })
})
