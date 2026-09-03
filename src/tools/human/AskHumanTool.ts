import type { ITool, ToolResult } from '../ITool.ts'
import type { JSONSchema } from '../../llm/types.ts'
import type { ExecutionContext } from '../../core/ExecutionContext.ts'
import { AskHumanSignal, type AskHumanQuestions } from './AskHumanSignal.ts'

/** Caps: questions persist verbatim to the event store and ship to every
 * viewer, so the schema bounds what one parked run can store/fan out. */
export const MAX_QUESTIONS = 10
export const MAX_LABEL_LENGTH = 500
export const MAX_DESCRIPTION_LENGTH = 2000
export const MAX_OPTIONS = 20
export const MAX_OPTION_LENGTH = 200

export const askHumanInputSchema = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      description: 'Questions for the human (label + optional description and options)',
      minItems: 1,
      maxItems: MAX_QUESTIONS,
      items: {
        type: 'object',
        properties: {
          label: { type: 'string', description: 'The question in one line', maxLength: MAX_LABEL_LENGTH },
          description: { type: 'string', description: 'Extra context the human needs', maxLength: MAX_DESCRIPTION_LENGTH },
          options: { type: 'array', description: 'Candidate answers, if any', maxItems: MAX_OPTIONS, items: { type: 'string', maxLength: MAX_OPTION_LENGTH } },
        },
        required: ['label'],
      },
    },
  },
  required: ['questions'],
} as JSONSchema

/**
 * Parks the run until a human answers. Never returns a ToolResult: execute
 * always throws AskHumanSignal, which the loop rethrows so the host can
 * persist the question and release the worker slot. Registered directly by
 * MemberRunner for every member run — it is a HITL escalation primitive, not
 * a capability, so it bypasses the permission-profile gate by design.
 */
export class AskHumanTool implements ITool {
  name = 'ask_human'
  description =
    'Ask the human a question and wait for their reply. Use when blocked on a decision only the human can make (scope, credentials, approval). The run parks until the reply arrives as a linked follow-up session.'
  inputSchema = askHumanInputSchema

  async execute(input: unknown, _context: ExecutionContext): Promise<ToolResult> {
    const questions = (input as { questions?: unknown })?.questions
    if (!Array.isArray(questions) || questions.length === 0 || questions.some((q) => typeof (q as { label?: unknown })?.label !== 'string')) {
      return { success: false, output: '', error: 'ask_human requires a non-empty questions array with string labels' }
    }
    // the loop validates against the schema first, but the tool is also
    // directly callable — enforce the store/fan-out caps here too
    const oversize =
      questions.length > MAX_QUESTIONS ||
      questions.some((q) => {
        const item = q as { label?: unknown; description?: unknown; options?: unknown }
        return (
          typeof item.label !== 'string' ||
          item.label.length > MAX_LABEL_LENGTH ||
          (item.description !== undefined && (typeof item.description !== 'string' || item.description.length > MAX_DESCRIPTION_LENGTH)) ||
          (item.options !== undefined &&
            (!Array.isArray(item.options) ||
              item.options.length > MAX_OPTIONS ||
              item.options.some((o) => typeof o !== 'string' || o.length > MAX_OPTION_LENGTH)))
        )
      })
    if (oversize) {
      return { success: false, output: '', error: 'ask_human questions exceed the size caps (10 questions, 500-char labels, 20 options of 200 chars)' }
    }
    throw new AskHumanSignal({ questions } as AskHumanQuestions)
  }
}
