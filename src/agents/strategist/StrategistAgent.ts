import { BaseAgent } from '../base/BaseAgent.ts'
import { USER_QUERY_GUARD, wrapUserQuery } from '../memberLore.ts'
import type { ExecutionContext } from '../../core/ExecutionContext.js'
import type { ITool } from '../../tools/ITool.js'
import type { AgentResult } from '../base/AgentResult.js'

const OUTPUT_FORMAT = [
  '## Problem Statement', '',
  '## Success Criteria', '',
  '## Ranked Priorities', '',
  '## Risks and Constraints', '',
  '## Suggested Handoff',
].join('\n')

function prepareStrategistInput(input: string): string {
  // strip injected user_query delimiters so crafted goals cannot break out
  // of the trust boundary, then re-wrap so the guard in the system prompt
  // describes reality
  return `Transform the following goal into a structured brief.\n\n${wrapUserQuery(input)}\n\nOutput format:\n${OUTPUT_FORMAT}\n`
}

export class StrategistAgent extends BaseAgent {
  role = 'the-strategist'
  protected tools: ITool[] = []

  protected async getSystemPrompt(_context: ExecutionContext): Promise<string> {
    return [
      'You are the Strategist, a Society Member that translates ambiguous goals into structured problem statements. You never write code, run commands, or edit files. Your output is consumed by The Architect.',
      USER_QUERY_GUARD,
    ].join('\n')
  }

  async run(input: string, context: ExecutionContext): Promise<AgentResult> {
    return super.run(prepareStrategistInput(input), context)
  }
}
