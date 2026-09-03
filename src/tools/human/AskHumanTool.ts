import type { ITool, ToolResult } from '../ITool.ts'
import type { JSONSchema } from '../../llm/types.ts'
import type { ExecutionContext } from '../../core/ExecutionContext.ts'
import { validateSchema } from '../../core/SchemaValidator.ts'

export interface AskHumanPayload {
  question: string
  context?: string
}

// Model output is untrusted input to the human room — cap it so a runaway
// or injected prompt cannot flood the interface. Enforced by the schema on
// the ReActLoop path and re-checked in execute() for direct invocations.
export const ASK_HUMAN_MAX_QUESTION_LENGTH = 4000
export const ASK_HUMAN_MAX_CONTEXT_LENGTH = 1000

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
    question: {
      type: 'string',
      description: 'Question for the human room',
      maxLength: ASK_HUMAN_MAX_QUESTION_LENGTH,
    },
    context: {
      type: 'string',
      description: 'Optional threading/context for the reply',
      maxLength: ASK_HUMAN_MAX_CONTEXT_LENGTH,
    },
  },
  required: ['question'],
}

export class AskHumanTool implements ITool {
  name = 'ask_human'
  description = 'Ask the human room a question and park the run until a reply arrives. Throws AskHumanSignal; never returns normally.'
  inputSchema = askHumanInputSchema

  async execute(input: unknown, _context: ExecutionContext): Promise<ToolResult> {
    validateSchema(input, askHumanInputSchema)
    const { question, context } = input as { question: string; context?: string }
    throw new AskHumanSignal({ question, context })
  }
}
