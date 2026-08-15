import { WrappedTaskAgent } from '../wrappedTaskAgent.ts'
import type { ExecutionContext } from '../../core/ExecutionContext.ts'
import type { ITool } from '../../tools/ITool.ts'

const OUTPUT_FORMAT = [
  '## Problem Statement', '',
  '## Success Criteria', '',
  '## Ranked Priorities', '',
  '## Risks and Constraints', '',
  '## Suggested Handoff',
].join('\n')

export class StrategistAgent extends WrappedTaskAgent {
  role = 'the-strategist'
  protected tools: ITool[] = []
  protected readonly taskIntro = 'Transform the following goal into a structured brief.'
  protected readonly outputFormat = OUTPUT_FORMAT
  protected readonly guardSuffix = ' Structure the goal into the brief below.'

  protected async getSystemPrompt(_context: ExecutionContext): Promise<string> {
    return this.buildSystemPrompt(
      'You are the Strategist, a Society Member that translates ambiguous goals into structured problem statements. You never write code, run commands, or edit files. Your output is consumed by The Architect.',
    )
  }
}
