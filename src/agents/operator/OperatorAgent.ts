import { WrappedTaskAgent } from '../wrappedTaskAgent.ts'
import type { ExecutionContext } from '../../core/ExecutionContext.ts'
import type { ITool } from '../../tools/ITool.ts'

const OUTPUT_FORMAT = [
  '## Symptom', '',
  '## Health Indicators', '',
  '## Action Taken', '',
  '## Outcome', '',
  '## Escalation',
].join('\n')

export class OperatorAgent extends WrappedTaskAgent {
  role = 'the-operator'
  protected tools: ITool[] = []
  protected readonly taskIntro = 'Triage the following runtime situation and produce an operation report.'
  protected readonly outputFormat = OUTPUT_FORMAT
  protected readonly guardSuffix = ' Triage the situation and report on it.'

  protected async getSystemPrompt(_context: ExecutionContext): Promise<string> {
    return this.buildSystemPrompt(
      'You are the Operator, a Society Member that manages runtime health, deployment verification, rollback execution, incident triage, and monitoring. You do not debug — you triage. You do not design — you execute. Your output is consumed by The Debugger when escalation is needed.',
    )
  }
}
