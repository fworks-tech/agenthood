import type { ITool, ToolResult } from '../ITool.ts'
import type { JSONSchema } from '../../llm/types.ts'
import type { ExecutionContext } from '../../core/ExecutionContext.ts'

export interface AskHumanPayload {
  question: string
  context?: string
}

export class AskHumanSignal extends Error {
  readonly payload: AskHumanPayload

  constructor(payload: AskHumanPayload) {
    super(payload.question)
    this.name = 'AskHumanSignal'
    this.payload = payload
  }
}

export const askHumanInputSchema: JSONSchema = {
  type: 'object',
  properties: {
    question: { type: 'string', description: 'Question for the human room' },
    context: { type: 'string', description: 'Optional threading/context for the reply' },
  },
  required: ['question'],
}

export class AskHumanTool implements ITool {
  name = 'ask_human'
  description = 'Ask the human room a question and park the run until a reply arrives. Throws AskHumanSignal; never returns normally.'
  inputSchema = askHumanInputSchema

  async execute(input: unknown, _context: ExecutionContext): Promise<ToolResult> {
    const { question, context } = input as { question: string; context?: string }
    throw new AskHumanSignal({ question, context })
  }
}
