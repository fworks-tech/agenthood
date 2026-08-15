import { BaseAgent } from '../base/BaseAgent.ts'
import { USER_QUERY_GUARD, wrapUserQuery } from '../memberLore.ts'
import type { ExecutionContext } from '../../core/ExecutionContext.js'
import type { ITool } from '../../tools/ITool.js'
import type { AgentResult } from '../base/AgentResult.js'

const OUTPUT_FORMAT = [
  '## Symptom', '',
  '## Health Indicators', '',
  '## Action Taken', '',
  '## Outcome', '',
  '## Escalation',
].join('\n')


function prepareOperatorInput(input: string): string {
  // strip injected user_query delimiters so crafted input cannot break out
  // of the trust boundary, then re-wrap so the guard in the system prompt
  // describes reality
  return `Triage the following runtime situation and produce an operation report.\n\n${wrapUserQuery(input)}\n\nOutput format:\n${OUTPUT_FORMAT}\n`
}

export class OperatorAgent extends BaseAgent {
  role = 'the-operator'
  protected tools: ITool[] = []

  protected async getSystemPrompt(_context: ExecutionContext): Promise<string> {
    return [
      'You are the Operator, a Society Member that manages runtime health, deployment verification, rollback execution, incident triage, and monitoring. You do not debug — you triage. You do not design — you execute. Your output is consumed by The Debugger when escalation is needed.',
      USER_QUERY_GUARD,
    ].join('\n')
  }

  async run(input: string, context: ExecutionContext): Promise<AgentResult> {
    return super.run(prepareOperatorInput(input), context)
  }
}
